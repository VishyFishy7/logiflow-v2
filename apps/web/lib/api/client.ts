/**
 * The one API client (PRD §4.5, §9.9).
 *
 * Every screen goes through here — no ad-hoc `fetch` in components. It speaks
 * the contract's envelopes exactly:
 *   - lists      → `ListEnvelope<T>` (data + page + pageSize + total + totalPages)
 *   - items      → `{ data: T }`
 *   - failures   → `{ error: { code, message, fieldErrors?, requestId? } }`
 *
 * In mock mode MSW intercepts these same requests, so a screen cannot tell
 * which mode it is in, and a mock can never invent a route the server lacks
 * (§19 #3).
 */
import type {
  ApiErrorBody,
  ApiErrorCode,
  ListEnvelope,
} from "@logiflow/contracts";

export const API_BASE = "/api/v1";

/** Structured failure carrying the contract's error code, not just a message. */
export class ApiError extends Error {
  readonly code: ApiErrorCode | "NETWORK_ERROR";
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  readonly requestId?: string;

  constructor(
    code: ApiErrorCode | "NETWORK_ERROR",
    message: string,
    status: number,
    fieldErrors?: Record<string, string>,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }

  /** Field-level message for a form input, if the server sent one. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors?.[field];
  }
}

export type QueryValue = string | number | boolean | undefined | null;

/** Serialises a params object, dropping empty values so URLs stay readable. */
export function toQueryString(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Send an Idempotency-Key; pass a stable one to retry a POST safely (§9.9). */
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Set by the theme/brand switcher so responses can be traced to a surface. */
  headers?: Record<string, string>;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { error?: ApiErrorBody } | undefined;
  try {
    body = (await res.json()) as { error?: ApiErrorBody };
  } catch {
    body = undefined;
  }
  const err = body?.error;
  return new ApiError(
    err?.code ?? "INTERNAL_ERROR",
    err?.message ?? `Request failed with status ${res.status}`,
    res.status,
    err?.fieldErrors,
    err?.requestId ?? res.headers.get("x-request-id") ?? undefined,
  );
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${path}${toQueryString(options.query)}`;
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method === "POST") headers["Idempotency-Key"] = options.idempotencyKey ?? newIdempotencyKey();

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: "same-origin",
      signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (cause) {
    if ((cause as Error)?.name === "AbortError") throw cause;
    throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.", 0);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Raw verbs — prefer the typed helpers in `lib/api/resources.ts` below. */
export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
};

/** A paginated list straight off the wire. */
export function list<T>(
  path: string,
  query?: Record<string, QueryValue>,
  signal?: AbortSignal,
): Promise<ListEnvelope<T>> {
  return http.get<ListEnvelope<T>>(path, { query, signal });
}

/** A single resource response, unwrapping the `{ data }` envelope (§4.5). */
export async function item<T>(
  path: string,
  query?: Record<string, QueryValue>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await http.get<{ data: T }>(path, { query, signal });
  return res.data;
}

/** A non-enveloped response (session, stats, public tracking). */
export function plain<T>(
  path: string,
  query?: Record<string, QueryValue>,
  signal?: AbortSignal,
): Promise<T> {
  return http.get<T>(path, { query, signal });
}

/**
 * Fetches a CSV/JSONL export and hands the browser a download. Exports must be
 * sent with the caller's session cookie, which is why this is not a plain link
 * when the target is behind auth (§9.8).
 */
export async function download(path: string, query?: Record<string, QueryValue>): Promise<void> {
  const url = `${API_BASE}${path}${toQueryString(query)}`;
  const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "*/*" } });
  if (!res.ok) throw await toApiError(res);

  const disposition = res.headers.get("content-disposition") ?? "";
  const matched = /filename="?([^";]+)"?/.exec(disposition);
  const filename = matched?.[1] ?? path.split("/").pop() ?? "export";

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Human-readable message for any thrown value, for toasts and error states. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** True when the failure means "you are not allowed", not "it is broken". */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "UNAUTHENTICATED");
}
