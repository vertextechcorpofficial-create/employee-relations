import { NextRequest, NextResponse } from "next/server";
import {
  deleteUnattachedStagedFile,
  getDirectusBaseUrl,
  getDirectusHeaders,
  handleJobOrderApiError,
  JO_UPLOAD_FOLDER,
  resolveDecoupledActor,
} from "@/modules/er/job-order/services";
import {
  AttachmentKind,
  JO_ALLOWED_FILE_EXTENSIONS,
  JO_MAX_FILE_BYTES,
} from "@/modules/er/job-order/types/job-order.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set<string>(JO_ALLOWED_FILE_EXTENSIONS);
const PICTURE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return fileName.slice(lastDot + 1).toLowerCase().trim();
}

function inferAttachmentKind(file: File, ext: string): AttachmentKind {
  if (file.type.startsWith("image/") || PICTURE_EXTENSIONS.has(ext)) {
    return "PICTURE";
  }
  return "DOCUMENT";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("VALIDATION_FAILED: No file provided");
    }

    if (file.size > JO_MAX_FILE_BYTES) {
      throw new Error("VALIDATION_FAILED: File size exceeds 10MB limit");
    }

    const ext = extractExtension(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `VALIDATION_FAILED: Unsupported or missing file extension${ext ? ` ".${ext}"` : ""}. Allowed: images, PDF, Word, Excel, CSV, TXT.`
      );
    }

    const baseUrl = getDirectusBaseUrl();
    const directusForm = new FormData();
    directusForm.append("file", file, file.name);

    const uploadRes = await fetch(`${baseUrl}/files`, {
      method: "POST",
      headers: getDirectusHeaders(false),
      body: directusForm,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => uploadRes.statusText);
      throw new Error(`INTERNAL_FAIL: Directus upload failed (${uploadRes.status}) - ${errText}`);
    }

    const uploadPayload = (await uploadRes.json()) as {
      data?: {
        id?: string;
        filename_download?: string;
        filesize?: number;
        type?: string;
      };
    };

    const fileId = uploadPayload.data?.id;
    if (!fileId) {
      throw new Error("INTERNAL_FAIL: Directus did not return a file ID");
    }

    // Assign uploaded file into the `job_order` Directus folder
    const folderRes = await fetch(
      `${baseUrl}/folders?filter[name][_eq]=${encodeURIComponent(JO_UPLOAD_FOLDER)}`,
      { headers: getDirectusHeaders(false) }
    );
    if (folderRes.ok) {
      const folderData = (await folderRes.json()) as { data?: Array<{ id: string }> };
      const folderId = folderData.data?.[0]?.id;
      if (folderId) {
        const patchRes = await fetch(`${baseUrl}/files/${fileId}`, {
          method: "PATCH",
          headers: getDirectusHeaders(true),
          body: JSON.stringify({ folder: folderId }),
        });
        if (!patchRes.ok) {
          console.warn(`[JobOrder] Failed to assign file ${fileId} to folder "${JO_UPLOAD_FOLDER}": HTTP ${patchRes.status}`);
        }
      }
    }

    const attachmentKind = inferAttachmentKind(file, ext);

    return NextResponse.json(
      {
        data: {
          file_id: fileId,
          file_url: `/api/er/job-order/file?id=${fileId}`,
          file_name: uploadPayload.data?.filename_download ?? file.name,
          file_type: uploadPayload.data?.type ?? file.type ?? "application/octet-stream",
          attachment_kind: attachmentKind,
          filesize: uploadPayload.data?.filesize ?? file.size,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const fileId = request.nextUrl.searchParams.get("id");
    if (!fileId || !UUID_PATTERN.test(fileId)) {
      throw new Error("VALIDATION_FAILED: Valid Directus file ID is required");
    }

    await deleteUnattachedStagedFile(fileId);
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

