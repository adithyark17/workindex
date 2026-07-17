import type { CompanyEventType } from "../contracts";
import { collapseWhitespace } from "../normalization";

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

export function decodeXmlEntities(value: string): string {
  return value.replace(/&(#\d+|#x[\da-f]+|amp|apos|gt|lt|quot);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const base = name[1]?.toLowerCase() === "x" ? 16 : 10;
      const digits = base === 16 ? name.slice(2) : name.slice(1);
      const codePoint = Number.parseInt(digits, base);
      return Number.isSafeInteger(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return XML_ENTITIES[name.toLowerCase()] ?? entity;
  });
}

export function textFromMarkup(value: string): string {
  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const withoutScripts = withoutCdata.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, " ");
  return collapseWhitespace(decodeXmlEntities(withoutScripts.replace(/<[^>]+>/g, " ")));
}

export function parseOptionalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function inferAnnouncementType(title: string, summary = ""): CompanyEventType {
  const text = `${title} ${summary}`.toLowerCase();
  if (/clos(?:e|es|ed|ing|ure)|shut(?:s|ting)? down/.test(text)) return "closure";
  if (/layoff|restructur|workforce reduction|contraction/.test(text)) return "contraction";
  if (/appoint|names? .*\b(?:head|leader|director|vp)\b|leadership/.test(text)) return "leadership";
  if (/expand|expansion|adds? .*\b(?:team|office|centre|center)\b|new team/.test(text)) return "expansion";
  if (/launch|opens?|inaugurat|new (?:office|centre|center|hub|gcc)/.test(text)) return "launch";
  if (/hir(?:e|es|ing)|recruit|jobs?/.test(text)) return "hiring";
  return "other";
}

export function inferIndianCity(text: string): string | null {
  const cities: Array<[RegExp, string]> = [
    [/\b(?:bengaluru|bangalore)\b/i, "Bengaluru"],
    [/\bhyderabad\b/i, "Hyderabad"],
    [/\bpune\b/i, "Pune"],
    [/\bchennai\b/i, "Chennai"],
    [/\bmumbai\b/i, "Mumbai"],
    [/\b(?:delhi|gurugram|gurgaon|noida)\b/i, "Delhi NCR"],
  ];
  return cities.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
