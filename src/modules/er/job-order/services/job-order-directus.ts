const DIRECTUS_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export const JO_COLLECTIONS = {
  CATEGORY: "iot_jo_service_category",
  REQUEST: "iot_jo_request",
  ATTACHMENT: "iot_jo_attachment",
} as const;

export const JO_UPLOAD_FOLDER = "job_order";

/**
 * Resolves the Directus base URL cleanly or throws a coded configuration error.
 */
export function getDirectusBaseUrl(): string {
  if (!DIRECTUS_BASE_URL) {
    throw new Error("INTERNAL_FAIL: NEXT_PUBLIC_API_BASE_URL is not configured");
  }
  return DIRECTUS_BASE_URL.replace(/\/+$/, "");
}

/**
 * Builds authenticated Directus REST headers using the static system token.
 */
export function getDirectusHeaders(includeJsonContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  if (DIRECTUS_STATIC_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
  }
  return headers;
}

/**
 * Executes a Directus REST request and unwraps the `{ data }` payload.
 */
export async function directusRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getDirectusBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`${baseUrl}${normalizedPath}`, {
    ...options,
    headers: {
      ...getDirectusHeaders(!(options.body instanceof FormData)),
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    if (res.status === 404) {
      throw new Error(`DB_NOT_FOUND: ${errorText}`);
    }
    throw new Error(`INTERNAL_FAIL: Directus ${res.status} - ${errorText}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = (await res.json()) as { data?: T };
  return (json.data !== undefined ? json.data : json) as T;
}

/**
 * Formats current Manila timestamp (`YYYY-MM-DDTHH:mm:ss`) for Directus dateTime columns.
 * Uses `hourCycle: "h23"` so midnight formats as `00` rather than `24`.
 */
export function getManilaIsoDateTime(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const pick = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const rawHour = pick("hour");
  const hour = rawHour === "24" ? "00" : rawHour;

  return `${pick("year")}-${pick("month")}-${pick("day")}T${hour}:${pick("minute")}:${pick("second")}`;
}

/**
 * Checks whether a Directus file UUID belongs to a Job Order attachment or the `job_order` upload folder.
 */
export async function isJobOrderOwnedFile(fileId: string): Promise<boolean> {
  const attachmentParams = new URLSearchParams({
    fields: "id",
    limit: "1",
  });
  attachmentParams.set("filter[directus_file_id][_eq]", fileId);

  const attachments = await directusRequest<Array<{ id: number }>>(
    `/items/${JO_COLLECTIONS.ATTACHMENT}?${attachmentParams.toString()}`
  );
  if (Array.isArray(attachments) && attachments.length > 0) {
    return true;
  }

  try {
    const fileMeta = await directusRequest<{
      id?: string;
      folder?: { name?: string | null } | string | null;
    }>(`/files/${encodeURIComponent(fileId)}?fields=id,folder.name`);

    if (
      fileMeta?.folder &&
      typeof fileMeta.folder === "object" &&
      fileMeta.folder.name === JO_UPLOAD_FOLDER
    ) {
      return true;
    }

    const folderRes = await directusRequest<Array<{ id: string }>>(
      `/folders?filter[name][_eq]=${encodeURIComponent(JO_UPLOAD_FOLDER)}&fields=id&limit=1`
    );
    const jobOrderFolderId = Array.isArray(folderRes) ? folderRes[0]?.id : undefined;
    if (
      jobOrderFolderId &&
      typeof fileMeta?.folder === "string" &&
      fileMeta.folder === jobOrderFolderId
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Deletes an unattached staged file from Directus when removed or canceled before JO submission.
 * Never deletes files already linked in `iot_jo_attachment`.
 */
export async function deleteUnattachedStagedFile(fileId: string): Promise<void> {
  const attachmentParams = new URLSearchParams({
    fields: "id",
    limit: "1",
  });
  attachmentParams.set("filter[directus_file_id][_eq]", fileId);

  const linked = await directusRequest<Array<{ id: number }>>(
    `/items/${JO_COLLECTIONS.ATTACHMENT}?${attachmentParams.toString()}`
  );
  if (Array.isArray(linked) && linked.length > 0) {
    throw new Error("VALIDATION_FAILED: Cannot delete a file already linked to a Job Order");
  }

  const ownedInFolder = await isJobOrderOwnedFile(fileId);
  if (!ownedInFolder) {
    throw new Error("AUTH_DENIED: File does not belong to the Job Order staging folder");
  }

  await directusRequest<void>(`/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}

