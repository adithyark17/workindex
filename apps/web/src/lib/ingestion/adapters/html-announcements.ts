import type { AdapterResult, AnnouncementCandidate, SourceDocument } from "../contracts";
import { stableJsonHash } from "../hash";
import { canonicalisePublicUrl } from "../normalization";
import {
  inferAnnouncementType,
  inferIndianCity,
  parseOptionalDate,
  textFromMarkup,
} from "./shared";

export const HTML_ANNOUNCEMENT_PARSER_VERSION = "configured-html-v1";

export type SimpleHtmlSelector = {
  tag: string;
  className?: string;
  attribute?: string;
};

export type HtmlAnnouncementConfig = {
  item: Omit<SimpleHtmlSelector, "attribute">;
  title: SimpleHtmlSelector;
  link: SimpleHtmlSelector;
  date?: SimpleHtmlSelector;
  summary?: SimpleHtmlSelector;
};

function safeIdentifier(value: string, label: string): string {
  if (!/^[a-z][a-z0-9-]*$/i.test(value)) throw new Error(`Invalid ${label}: ${value}`);
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function openingTagMatchesClass(openingTag: string, className?: string): boolean {
  if (!className) return true;
  const classValue = /\bclass\s*=\s*["']([^"']*)["']/i.exec(openingTag)?.[1] ?? "";
  return classValue.split(/\s+/).includes(className);
}

function blocksFor(html: string, selector: SimpleHtmlSelector): Array<{ opening: string; inner: string }> {
  const tag = safeIdentifier(selector.tag, "tag");
  if (selector.className) safeIdentifier(selector.className, "class name");
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return [...html.matchAll(pattern)]
    .map((match) => ({ opening: match[1] ?? "", inner: match[2] ?? "" }))
    .filter((block) => openingTagMatchesClass(block.opening, selector.className));
}

function fieldFrom(block: string, selector: SimpleHtmlSelector): string | null {
  const match = blocksFor(block, selector)[0];
  if (!match) return null;
  if (selector.attribute) {
    const attribute = safeIdentifier(selector.attribute, "attribute");
    const attributeMatch = new RegExp(
      `\\b${escapeRegExp(attribute)}\\s*=\\s*["']([^"']*)["']`,
      "i",
    ).exec(match.opening);
    return attributeMatch?.[1] ?? null;
  }
  return textFromMarkup(match.inner);
}

export function createHtmlAnnouncementAdapter(config: HtmlAnnouncementConfig) {
  safeIdentifier(config.item.tag, "item tag");
  if (config.item.className) safeIdentifier(config.item.className, "item class name");
  return {
    key: "configured-html-announcements",
    method: "configured_html" as const,
    parserVersion: HTML_ANNOUNCEMENT_PARSER_VERSION,
    parse(document: SourceDocument): AdapterResult<AnnouncementCandidate> {
      const issues: AdapterResult<AnnouncementCandidate>["issues"] = [];
      const items: AnnouncementCandidate[] = [];
      for (const item of blocksFor(document.body, config.item)) {
        const title = fieldFrom(item.inner, config.title);
        const rawUrl = fieldFrom(item.inner, config.link);
        if (!title || !rawUrl) {
          issues.push({
            code: "missing_required_field",
            message: "Configured HTML item requires title and link fields.",
          });
          continue;
        }
        let url: string;
        try {
          url = canonicalisePublicUrl(rawUrl, document.source.canonicalUrl);
        } catch {
          issues.push({ code: "invalid_url", message: "Configured HTML item URL was invalid." });
          continue;
        }
        const summary = config.summary ? fieldFrom(item.inner, config.summary) : null;
        const dateValue = config.date ? fieldFrom(item.inner, config.date) : null;
        const publishedAt = parseOptionalDate(dateValue);
        items.push({
          sourceId: document.source.id,
          externalId: url,
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
        issues.push({ code: "empty_page", message: "No configured announcement items were found." });
      }
      return { items, issues, parserVersion: HTML_ANNOUNCEMENT_PARSER_VERSION };
    },
  };
}
