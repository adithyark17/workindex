import type {
  AdapterResult,
  AnnouncementCandidate,
  IngestionAdapter,
  SourceDocument,
} from "../contracts";
import { sha256, stableJsonHash } from "../hash";
import { canonicalisePublicUrl } from "../normalization";
import {
  inferAnnouncementType,
  inferIndianCity,
  parseOptionalDate,
  textFromMarkup,
} from "./shared";

export const RSS_ATOM_PARSER_VERSION = "rss-atom-v1";

function firstTag(block: string, names: readonly string[]): string | null {
  for (const name of names) {
    const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i").exec(block);
    if (match?.[1]) return textFromMarkup(match[1]);
  }
  return null;
}

function atomLink(block: string): string | null {
  const alternate = /<link\b(?=[^>]*\brel=["']alternate["'])[^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block);
  if (alternate?.[1]) return alternate[1];
  return /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block)?.[1] ?? null;
}

function itemBlocks(xml: string): string[] {
  const tag = /<item\b/i.test(xml) ? "item" : "entry";
  return [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map(
    (match) => match[1] ?? "",
  );
}

export const rssAtomAnnouncementAdapter: IngestionAdapter<AnnouncementCandidate> = {
  key: "rss-atom-announcements",
  method: "rss_atom",
  parserVersion: RSS_ATOM_PARSER_VERSION,
  parse(document: SourceDocument): AdapterResult<AnnouncementCandidate> {
    if (/<!DOCTYPE/i.test(document.body)) {
      return {
        items: [],
        issues: [{ code: "doctype_rejected", message: "Feeds containing a DOCTYPE are rejected." }],
        parserVersion: RSS_ATOM_PARSER_VERSION,
      };
    }
    const issues: AdapterResult<AnnouncementCandidate>["issues"] = [];
    const items: AnnouncementCandidate[] = [];
    for (const block of itemBlocks(document.body)) {
      const title = firstTag(block, ["title"]);
      const rawUrl = firstTag(block, ["link"]) ?? atomLink(block);
      const identifier = firstTag(block, ["guid", "id"]);
      if (!title || !rawUrl) {
        issues.push({
          code: "missing_required_field",
          message: "Announcement feed item requires a title and link.",
          itemKey: identifier ?? undefined,
        });
        continue;
      }
      let url: string;
      try {
        url = canonicalisePublicUrl(rawUrl, document.source.canonicalUrl);
      } catch {
        issues.push({ code: "invalid_url", message: "Announcement URL was invalid." });
        continue;
      }
      const summary = firstTag(block, ["description", "summary", "content:encoded", "content"]);
      const publishedAt = parseOptionalDate(
        firstTag(block, ["pubDate", "published", "updated", "dc:date"]),
      );
      const externalId = identifier ?? url ?? sha256(title);
      items.push({
        sourceId: document.source.id,
        externalId,
        title,
        summary,
        url,
        publishedAt,
        eventType: inferAnnouncementType(title, summary ?? ""),
        city: inferIndianCity(`${title} ${summary ?? ""}`),
        contentHash: stableJsonHash({ title, summary, url, publishedAt }),
      });
    }
    if (items.length === 0 && issues.length === 0) {
      issues.push({ code: "empty_feed", message: "No RSS item or Atom entry elements were found." });
    }
    return { items, issues, parserVersion: RSS_ATOM_PARSER_VERSION };
  },
};
