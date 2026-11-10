import { NextRequest, NextResponse } from "next/server";
import {
  getDirectusBaseUrl,
  getDirectusHeaders,
  handleJobOrderApiError,
  JO_UPLOAD_FOLDER,
  resolveDecoupledActor,
} from "@/modules/er/job-order/services";
import { AttachmentKind } from "@/modules/er/job-order/types/job-order.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
]);

function inferAttachmentKind(file: File): AttachmentKind {
  if (file.type.startsWith("image/")) {
    return "PICTURE";
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
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

    if (file.size > MAX_FILE_BYTES) {
      throw new Error("VALIDATION_FAILED: File size exceeds 10MB limit");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `VALIDATION_FAILED: Unsupported file type ".${ext}". Allowed: images, PDF, Word, Excel, CSV, TXT.`
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

    // Assign uploaded file into the `job_order` Directus folder if it exists
    const folderRes = await fetch(
      `${baseUrl}/folders?filter[name][_eq]=${encodeURIComponent(JO_UPLOAD_FOLDER)}`,
      { headers: getDirectusHeaders(false) }
    );
    if (folderRes.ok) {
      const folderData = (await folderRes.json()) as { data?: Array<{ id: string }> };
      const folderId = folderData.data?.[0]?.id;
      if (folderId) {
        await fetch(`${baseUrl}/files/${fileId}`, {
          method: "PATCH",
          headers: getDirectusHeaders(true),
          body: JSON.stringify({ folder: folderId }),
        });
      }
    }

    const attachmentKind = inferAttachmentKind(file);

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

