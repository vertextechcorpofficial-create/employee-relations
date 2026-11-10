import { NextRequest, NextResponse } from "next/server";
import {
  getDirectusBaseUrl,
  getDirectusHeaders,
  handleJobOrderApiError,
  resolveDecoupledActor,
} from "@/modules/er/job-order/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const contentType =
      fileRes.headers.get("content-type") ?? "application/octet-stream";
    const contentDisposition =
      fileRes.headers.get("content-disposition") ??
      (download ? "attachment" : "inline");
    const buffer = await fileRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

