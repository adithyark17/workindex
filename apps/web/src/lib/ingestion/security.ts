import { assertFetchPermitted } from "./compliance";
import type {
  ComplianceRecord,
  ConditionalFetchState,
  IngestionSource,
  RetrievalMethod,
  SourceDocument,
} from "./contracts";

export type FetchLimits = {
  timeoutMs: number;
  maxBytes: number;
  allowedContentTypes: readonly string[];
};

const DEFAULT_LIMITS: FetchLimits = {
  timeoutMs: 10_000,
  maxBytes: 5_000_000,
  allowedContentTypes: [
    "application/json",
    "application/rss+xml",
    "application/atom+xml",
    "application/xml",
    "text/xml",
    "text/html",
  ],
};

export class SourceSecurityError extends Error {
  constructor(
    message: string,
    readonly code: "unsafe_url" | "content_type" | "content_size" | "http_status",
  ) {
    super(message);
    this.name = "SourceSecurityError";
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((part) => part > 255)) return true;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function assertSafeExternalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SourceSecurityError("Source URL is invalid.", "unsafe_url");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local") ||
    isPrivateIpv4(host)
  ) {
    throw new SourceSecurityError("Source URL is not a permitted public HTTPS URL.", "unsafe_url");
  }
  return url;
}

export function sanitiseExternalText(value: string, maxLength = 20_000): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, maxLength);
}

export async function fetchPermittedSource(input: {
  source: IngestionSource;
  compliance: ComplianceRecord;
  method: RetrievalMethod;
  conditional?: ConditionalFetchState;
  fetchImpl?: typeof fetch;
  limits?: Partial<FetchLimits>;
  now?: Date;
}): Promise<SourceDocument> {
  assertFetchPermitted(input.source, input.compliance, input.method, input.now);
  const url = assertSafeExternalUrl(input.source.canonicalUrl);
  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), limits.timeoutMs);
  const headers = new Headers({
    Accept: limits.allowedContentTypes.join(", "),
    "User-Agent": "WorkIndexBot/0.1 (+https://workindex.example/methodology)",
  });
  if (input.conditional?.etag) headers.set("If-None-Match", input.conditional.etag);
  if (input.conditional?.lastModified) {
    headers.set("If-Modified-Since", input.conditional.lastModified);
  }

  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      headers,
      signal: controller.signal,
      redirect: "error",
      credentials: "omit",
    });
    if (response.status === 304) {
      return {
        source: input.source,
        fetchedAt: (input.now ?? new Date()).toISOString(),
        httpStatus: 304,
        contentType: response.headers.get("content-type") ?? "",
        body: "",
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    }
    if (!response.ok) {
      throw new SourceSecurityError(`Source returned HTTP ${response.status}.`, "http_status");
    }
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0]!.toLowerCase();
    if (!limits.allowedContentTypes.includes(contentType)) {
      throw new SourceSecurityError(`Unsupported source content type: ${contentType || "missing"}.`, "content_type");
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > limits.maxBytes) {
      throw new SourceSecurityError("Source exceeds the configured content-size limit.", "content_size");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limits.maxBytes) {
      throw new SourceSecurityError("Source exceeds the configured content-size limit.", "content_size");
    }
    return {
      source: input.source,
      fetchedAt: (input.now ?? new Date()).toISOString(),
      httpStatus: response.status,
      contentType,
      body: sanitiseExternalText(new TextDecoder("utf-8", { fatal: true }).decode(bytes), limits.maxBytes),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    };
  } finally {
    clearTimeout(timeout);
  }
}
