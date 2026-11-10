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
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

