import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { greenhouseAdapter, greenhouseBoardUrl } from "./adapters/greenhouse";
import { createHtmlAnnouncementAdapter } from "./adapters/html-announcements";
import { rssAtomAnnouncementAdapter } from "./adapters/rss-atom";
import { ComplianceError, assertFetchPermitted, retainAllowedFields } from "./compliance";
import type { ComplianceRecord, IngestionSource, JobCandidate, SourceDocument } from "./contracts";
import { sha256, stableJsonHash } from "./hash";
import { reconcileJobLifecycle } from "./job-lifecycle";
import { normaliseJob } from "./normalization";
import { SourceSecurityError, assertSafeExternalUrl, fetchPermittedSource } from "./security";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

const source: IngestionSource = {
  id: "source-1",
  registryId: "registry-1",
  canonicalUrl: "https://news.example.com/feed.xml",
  publisher: "Example Corporation",
  sourceType: "official_press_feed",
};

const compliance: ComplianceRecord = {
  id: "registry-1",
  version: 2,
  domain: "example.com",
  sourceType: "official_press_feed",
  permittedMethod: "rss_atom",
  robotsStatus: "reviewed_allowed",
  termsReviewStatus: "reviewed_allowed",
  rateLimitPerMinute: 5,
  retentionRule: "retain snapshots for 90 days",
  allowedFields: ["title", "summary", "url", "publishedAt"],
  lastLegalReviewedAt: "2026-07-01T00:00:00Z",
  legalReviewExpiresAt: "2027-07-01T00:00:00Z",
  status: "active",
};

const document = (body: string, contentType: string, overrideSource = source): SourceDocument => ({
  source: overrideSource,
  fetchedAt: "2026-07-17T00:00:00Z",
  httpStatus: 200,
  contentType,
  body,
});

describe("compliance and source security", () => {
  it("fails closed before a blocked source can reach fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      fetchPermittedSource({
        source,
        compliance: { ...compliance, status: "blocked" },
        method: "rss_atom",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ComplianceError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("enforces registry, reviewed domain, method, and review expiry", () => {
    expect(() => assertFetchPermitted(source, compliance, "rss_atom")).not.toThrow();
    expect(() =>
      assertFetchPermitted(source, { ...compliance, permittedMethod: "configured_html" }, "rss_atom"),
    ).toThrowError(/not permitted/);
    expect(() =>
      assertFetchPermitted(
        source,
        { ...compliance, legalReviewExpiresAt: "2026-07-16T00:00:00Z" },
        "rss_atom",
        new Date("2026-07-17T00:00:00Z"),
      ),
    ).toThrowError(/expired/);
  });

  it("blocks credentials, localhost, private IPs, and non-HTTPS URLs", () => {
    for (const url of [
      "http://news.example.com/feed",
      "https://user:secret@news.example.com/feed",
      "https://localhost/feed",
      "https://127.0.0.1/feed",
      "https://192.168.1.1/feed",
    ]) {
      expect(() => assertSafeExternalUrl(url)).toThrow(SourceSecurityError);
    }
    expect(assertSafeExternalUrl("https://news.example.com/feed").hostname).toBe("news.example.com");
  });

  it("sends conditional headers and accepts a bounded recorded response", async () => {
    let requestHeaders: Headers | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return new Response(fixture("official-feed.rss.xml"), {
        status: 200,
        headers: {
          "content-type": "application/rss+xml; charset=utf-8",
          etag: '"fixture-v2"',
        },
      });
    };
    const result = await fetchPermittedSource({
      source,
      compliance,
      method: "rss_atom",
      conditional: { etag: '"fixture-v1"', lastModified: "Wed, 01 Jul 2026 09:00:00 GMT" },
      fetchImpl,
      now: new Date("2026-07-17T00:00:00Z"),
    });
    expect(requestHeaders?.get("if-none-match")).toBe('"fixture-v1"');
    expect(requestHeaders?.get("if-modified-since")).toBe("Wed, 01 Jul 2026 09:00:00 GMT");
    expect(result).toMatchObject({
      httpStatus: 200,
      contentType: "application/rss+xml",
      etag: '"fixture-v2"',
    });
  });

  it("rejects a response that exceeds the configured byte budget", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("this response is deliberately too large", {
        headers: { "content-type": "text/html" },
      });
    await expect(
      fetchPermittedSource({
        source,
        compliance,
        method: "rss_atom",
        fetchImpl,
        limits: { maxBytes: 8 },
      }),
    ).rejects.toMatchObject({ code: "content_size" });
  });

  it("retains only fields approved by the registry", () => {
    expect(retainAllowedFields({ title: "Launch", salary: "secret", url: "/launch" }, ["title", "url"]))
      .toEqual({ title: "Launch", url: "/launch" });
  });
});

describe("stable hashing", () => {
  it("is deterministic across object-key ordering", () => {
    expect(stableJsonHash({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableJsonHash({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(sha256("workindex")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Greenhouse adapter", () => {
  it("parses recorded jobs, reports invalid records, and normalises India fields", () => {
    const greenhouseSource = {
      ...source,
      canonicalUrl: greenhouseBoardUrl("example-company"),
      sourceType: "public_ats",
    };
    const result = greenhouseAdapter.parse(
      document(fixture("greenhouse-board.json"), "application/json", greenhouseSource),
    );
    expect(result.items).toHaveLength(3);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "missing_required_field" }),
    ]);
    const first = normaliseJob(result.items[0]!);
    expect(first).toMatchObject({
      externalId: "71001",
      normalizedTitle: "Senior Software Engineer",
      roleFamily: "Software engineering",
      careerLevel: "senior",
      city: "Bengaluru",
      workplaceType: "hybrid",
    });
    expect(first.applicationUrl).not.toContain("utm_source");
    expect(first.descriptionHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("announcement adapters", () => {
  it("parses recorded RSS and Atom feeds without network access", () => {
    const rss = rssAtomAnnouncementAdapter.parse(
      document(fixture("official-feed.rss.xml"), "application/rss+xml"),
    );
    expect(rss.issues).toEqual([]);
    expect(rss.items).toHaveLength(2);
    expect(rss.items[0]).toMatchObject({ eventType: "launch", city: "Hyderabad" });
    expect(rss.items[0]?.url).not.toContain("utm_source");

    const atom = rssAtomAnnouncementAdapter.parse(
      document(fixture("official-feed.atom.xml"), "application/atom+xml"),
    );
    expect(atom.issues).toEqual([]);
    expect(atom.items).toEqual([
      expect.objectContaining({ eventType: "leadership", city: "Pune" }),
    ]);
  });

  it("rejects XML document types rather than expanding entities", () => {
    const result = rssAtomAnnouncementAdapter.parse(
      document("<!DOCTYPE rss><rss></rss>", "application/rss+xml"),
    );
    expect(result.items).toEqual([]);
    expect(result.issues[0]?.code).toBe("doctype_rejected");
  });

  it("parses only configured HTML announcement blocks", () => {
    const adapter = createHtmlAnnouncementAdapter({
      item: { tag: "article", className: "press-item" },
      title: { tag: "h2", className: "press-title" },
      link: { tag: "a", className: "press-link", attribute: "href" },
      date: { tag: "time", className: "press-date", attribute: "datetime" },
      summary: { tag: "p", className: "press-summary" },
    });
    const htmlSource = { ...source, canonicalUrl: "https://news.example.com/press" };
    const result = adapter.parse(
      document(fixture("official-announcements.html"), "text/html", htmlSource),
    );
    expect(result.issues).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items.map(({ eventType, city }) => ({ eventType, city }))).toEqual([
      { eventType: "launch", city: "Bengaluru" },
      { eventType: "expansion", city: "Pune" },
    ]);
    expect(result.items[1]?.url).toBe("https://news.example.com/press/pune-expansion");
  });
});

describe("job lifecycle reconciliation", () => {
  const candidate: JobCandidate = {
    sourceId: "source-1",
    externalId: "job-1",
    rawTitle: "Software Engineer",
    rawLocation: "Pune, India",
    rawDescription: "Build systems",
    applicationUrl: "https://jobs.example.com/job-1",
    publishedAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    workplaceType: "unknown",
    contentHash: sha256("v1"),
    descriptionHash: sha256("Build systems"),
  };

  it("discovers, closes after consecutive misses, and reopens without deleting history", () => {
    const discovered = reconcileJobLifecycle({
      existing: [],
      observed: [candidate],
      observedAt: "2026-07-17T00:00:00Z",
    })[0]!;
    expect(discovered.type).toBe("discovered");

    const firstMiss = reconcileJobLifecycle({
      existing: [discovered.next],
      observed: [],
      observedAt: "2026-07-18T00:00:00Z",
    })[0]!;
    expect(firstMiss.type).toBe("missing");
    expect(firstMiss.next.closedAt).toBeNull();

    const closed = reconcileJobLifecycle({
      existing: [firstMiss.next],
      observed: [],
      observedAt: "2026-07-19T00:00:00Z",
    })[0]!;
    expect(closed.type).toBe("closed");
    expect(closed.next.closedAt).toBe("2026-07-19T00:00:00Z");

    const reopened = reconcileJobLifecycle({
      existing: [closed.next],
      observed: [{ ...candidate, contentHash: sha256("v2") }],
      observedAt: "2026-07-20T00:00:00Z",
    })[0]!;
    expect(reopened.type).toBe("reopened");
    expect(reopened.next).toMatchObject({ closedAt: null, missingObservationCount: 0 });
    expect(reopened.next.firstSeenAt).toBe("2026-07-17T00:00:00Z");
  });
});
