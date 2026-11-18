import { NextRequest, NextResponse } from "next/server";
import {
  getDirectusBaseUrl,
  getDirectusHeaders,
  handleJobOrderApiError,
  isJobOrderOwnedFile,
  resolveDecoupledActor,
} from "@/modules/er/job-order/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_INLINE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const fileId = request.nextUrl.searchParams.get("id");
    if (!fileId || !UUID_PATTERN.test(fileId)) {
      throw new Error("VALIDATION_FAILED: Valid Directus file ID is required");
    }

    const isAllowed = await isJobOrderOwnedFile(fileId);
    if (!isAllowed) {
      throw new Error("DB_NOT_FOUND: Attachment file not found in Job Order records");
    }

    const download = request.nextUrl.searchParams.get("download") === "true";
    const baseUrl = getDirectusBaseUrl();
    const directusUrl = download
      ? `${baseUrl}/assets/${fileId}?download`
      : `${baseUrl}/assets/${fileId}`;

    const fileRes = await fetch(directusUrl, {
      headers: getDirectusHeaders(false),
      cache: "no-store",
    });

    if (!fileRes.ok) {
      if (fileRes.status === 404) {
        throw new Error("DB_NOT_FOUND: Attachment file not found");
      }
      throw new Error(`INTERNAL_FAIL: Asset fetch failed (${fileRes.status})`);
    }

    const rawContentType =
      fileRes.headers.get("content-type") ?? "application/octet-stream";
    const normalizedMime = rawContentType.split(";")[0]?.trim().toLowerCase() ?? "";
    const canRenderInline = !download && SAFE_INLINE_MIME_TYPES.has(normalizedMime);

    const upstreamDisposition = fileRes.headers.get("content-disposition");
    const contentDisposition = canRenderInline
      ? upstreamDisposition?.replace(/^attachment/i, "inline") ?? "inline"
      : upstreamDisposition?.replace(/^inline/i, "attachment") ?? "attachment";

    const responseBody = fileRes.body ?? (await fileRes.arrayBuffer());

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type": rawContentType,
        "Content-Disposition": contentDisposition,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

