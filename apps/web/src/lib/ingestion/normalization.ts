import type { JobCandidate, NormalizedJobCandidate } from "./contracts";

const CITY_ALIASES = new Map<string, string>([
  ["bengaluru", "Bengaluru"],
  ["bangalore", "Bengaluru"],
  ["hyderabad", "Hyderabad"],
  ["pune", "Pune"],
  ["chennai", "Chennai"],
  ["mumbai", "Mumbai"],
  ["new delhi", "Delhi NCR"],
  ["delhi", "Delhi NCR"],
  ["gurgaon", "Delhi NCR"],
  ["gurugram", "Delhi NCR"],
  ["noida", "Delhi NCR"],
]);

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normaliseCity(rawLocation: string | null): string | null {
  if (!rawLocation) return null;
  const lowered = collapseWhitespace(rawLocation).toLowerCase();
  for (const [alias, city] of CITY_ALIASES) {
    if (new RegExp(`(?:^|[^a-z])${alias.replace(" ", "\\s+")}(?:$|[^a-z])`, "i").test(lowered)) {
      return city;
    }
  }
  return null;
}

export function normaliseTitle(rawTitle: string): string {
  return collapseWhitespace(rawTitle)
    .replace(/\s*[-–—|]\s*(?:india|bengaluru|bangalore|hyderabad|pune|chennai|mumbai|gurugram|noida)\s*$/i, "")
    .replace(/\bSr\.?(?=\s|$)/gi, "Senior")
    .replace(/\bSDE\b/g, "Software Development Engineer");
}

export function inferRoleFamily(title: string): string | null {
  const normalised = title.toLowerCase();
  if (/machine learning|\bai\b|data scientist/.test(normalised)) return "Data & AI";
  if (/data engineer|analytics engineer|business intelligence/.test(normalised)) return "Data engineering";
  if (/security|cyber/.test(normalised)) return "Cybersecurity";
  if (/product manager|product owner/.test(normalised)) return "Product management";
  if (/designer|design systems|user experience|\bux\b/.test(normalised)) return "Design";
  if (/software|developer|engineer|platform|sre|reliability/.test(normalised)) {
    return "Software engineering";
  }
  return null;
}

export function inferCareerLevel(title: string): string | null {
  const normalised = title.toLowerCase();
  if (/\b(intern|graduate|trainee)\b/.test(normalised)) return "entry";
  if (/\b(principal|distinguished|director|head|vp|vice president)\b/.test(normalised)) return "leadership";
  if (/\b(staff|lead|manager|architect)\b/.test(normalised)) return "lead";
  if (/\b(senior|sr\.)\b/.test(normalised)) return "senior";
  return null;
}

export function normaliseJob(candidate: JobCandidate): NormalizedJobCandidate {
  const normalizedTitle = normaliseTitle(candidate.rawTitle);
  return {
    ...candidate,
    normalizedTitle,
    roleFamily: inferRoleFamily(normalizedTitle),
    careerLevel: inferCareerLevel(normalizedTitle),
    city: normaliseCity(candidate.rawLocation),
  };
}

export function canonicalisePublicUrl(rawUrl: string, baseUrl?: string): string {
  const url = new URL(rawUrl, baseUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|gclid|fbclid|ref$)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}
