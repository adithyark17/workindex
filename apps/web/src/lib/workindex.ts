export type Confidence = "high" | "medium" | "limited" | "unknown";
export type City = "Bengaluru" | "Hyderabad" | "Pune";
export type HiringMomentum = "Growing" | "Steady" | "Watch";
export type WorkplaceModel = "Hybrid" | "On-site" | "Flexible";

export type GccCompany = {
  slug: string;
  name: string;
  city: City;
  industry: string;
  capabilities: string[];
  hiringMomentum: HiringMomentum;
  workplaceModel: WorkplaceModel;
  headcountBand: string;
  launchedAt: string;
  summary: string;
  latestEvent: string;
  activeJobs: number;
  confidence: Confidence;
  confidenceReason: string;
  updatedAt: string;
  sourceCount: number;
  isDemo: boolean;
};

export const companies: GccCompany[] = [
  {
    slug: "astera-health-systems",
    name: "Astera Health Systems",
    city: "Hyderabad",
    industry: "Health technology",
    capabilities: ["Software engineering", "Data & AI"],
    hiringMomentum: "Growing",
    workplaceModel: "Hybrid",
    headcountBand: "201–500",
    launchedAt: "2025-11-18",
    summary: "A product engineering centre focused on clinical platforms and healthcare analytics.",
    latestEvent: "Announced a new applied AI team for clinical operations.",
    activeJobs: 18,
    confidence: "high",
    confidenceReason: "Three recent primary sources agree on the launch, mandate, and location.",
    updatedAt: "2026-07-14",
    sourceCount: 3,
    isDemo: true,
  },
  {
    slug: "northstar-payments",
    name: "Northstar Payments",
    city: "Bengaluru",
    industry: "Financial services",
    capabilities: ["Software engineering", "Cybersecurity"],
    hiringMomentum: "Growing",
    workplaceModel: "Hybrid",
    headcountBand: "501–1,000",
    launchedAt: "2024-08-02",
    summary: "A payments engineering hub building fraud, risk, and transaction infrastructure.",
    latestEvent: "Expanded its cloud security and reliability engineering charter.",
    activeJobs: 26,
    confidence: "high",
    confidenceReason: "Company announcements and current career listings corroborate the expansion.",
    updatedAt: "2026-07-12",
    sourceCount: 4,
    isDemo: true,
  },
  {
    slug: "verdant-mobility",
    name: "Verdant Mobility",
    city: "Pune",
    industry: "Automotive technology",
    capabilities: ["Embedded systems", "Data & AI"],
    hiringMomentum: "Steady",
    workplaceModel: "On-site",
    headcountBand: "201–500",
    launchedAt: "2025-03-21",
    summary: "An engineering centre for vehicle software, battery analytics, and simulation.",
    latestEvent: "Added a vehicle data platform team to the Pune mandate.",
    activeJobs: 11,
    confidence: "medium",
    confidenceReason: "The mandate is sourced; current headcount remains an employer estimate.",
    updatedAt: "2026-07-09",
    sourceCount: 2,
    isDemo: true,
  },
  {
    slug: "atlas-commerce-labs",
    name: "Atlas Commerce Labs",
    city: "Bengaluru",
    industry: "Retail technology",
    capabilities: ["Software engineering", "Product management"],
    hiringMomentum: "Growing",
    workplaceModel: "Flexible",
    headcountBand: "1,001–2,500",
    launchedAt: "2023-09-12",
    summary: "A commerce technology centre owning checkout, fulfilment, and merchant tooling.",
    latestEvent: "Opened hiring for a new merchant risk platform group.",
    activeJobs: 34,
    confidence: "high",
    confidenceReason: "Primary announcements and a broad set of current role listings align.",
    updatedAt: "2026-07-15",
    sourceCount: 5,
    isDemo: true,
  },
  {
    slug: "solace-energy-digital",
    name: "Solace Energy Digital",
    city: "Hyderabad",
    industry: "Energy",
    capabilities: ["Data & AI", "Cloud platform"],
    hiringMomentum: "Growing",
    workplaceModel: "Hybrid",
    headcountBand: "101–200",
    launchedAt: "2026-01-16",
    summary: "A new digital centre for grid optimisation, forecasting, and platform engineering.",
    latestEvent: "Named the first India site leader and began platform hiring.",
    activeJobs: 15,
    confidence: "medium",
    confidenceReason: "Launch and leadership are direct; team-size plans are reported, not observed.",
    updatedAt: "2026-07-11",
    sourceCount: 3,
    isDemo: true,
  },
  {
    slug: "meridian-industrial-tech",
    name: "Meridian Industrial Tech",
    city: "Pune",
    industry: "Industrial software",
    capabilities: ["Software engineering", "Quality engineering"],
    hiringMomentum: "Steady",
    workplaceModel: "Hybrid",
    headcountBand: "501–1,000",
    launchedAt: "2022-06-08",
    summary: "An established engineering centre for industrial automation and connected operations.",
    latestEvent: "Broadened ownership of its global testing automation platform.",
    activeJobs: 9,
    confidence: "high",
    confidenceReason: "Multiple primary sources describe both the site and its current mandate.",
    updatedAt: "2026-07-07",
    sourceCount: 4,
    isDemo: true,
  },
  {
    slug: "harbor-insurance-tech",
    name: "Harbor Insurance Tech",
    city: "Hyderabad",
    industry: "Insurance",
    capabilities: ["Software engineering", "Cloud platform"],
    hiringMomentum: "Watch",
    workplaceModel: "Hybrid",
    headcountBand: "201–500",
    launchedAt: "2024-12-05",
    summary: "A technology centre modernising policy platforms and internal developer tooling.",
    latestEvent: "Current job volume is lower than the previous 90-day observation window.",
    activeJobs: 4,
    confidence: "limited",
    confidenceReason: "The site is confirmed, but the recent hiring signal has only one fresh source.",
    updatedAt: "2026-06-29",
    sourceCount: 1,
    isDemo: true,
  },
  {
    slug: "kinetic-travel-platforms",
    name: "Kinetic Travel Platforms",
    city: "Bengaluru",
    industry: "Travel technology",
    capabilities: ["Software engineering", "Data & AI"],
    hiringMomentum: "Steady",
    workplaceModel: "Flexible",
    headcountBand: "501–1,000",
    launchedAt: "2021-10-20",
    summary: "A product centre for pricing, personalisation, and large-scale travel search.",
    latestEvent: "Added senior roles in experimentation and ranking systems.",
    activeJobs: 13,
    confidence: "high",
    confidenceReason: "The hiring signal is visible across the employer feed and primary career pages.",
    updatedAt: "2026-07-13",
    sourceCount: 4,
    isDemo: true,
  },
  {
    slug: "brightline-enterprise-cloud",
    name: "Brightline Enterprise Cloud",
    city: "Pune",
    industry: "Enterprise software",
    capabilities: ["Cloud platform", "Cybersecurity"],
    hiringMomentum: "Growing",
    workplaceModel: "Hybrid",
    headcountBand: "101–200",
    launchedAt: "2025-07-01",
    summary: "A cloud engineering team focused on enterprise identity and observability.",
    latestEvent: "Expanded into security engineering and incident response tooling.",
    activeJobs: 12,
    confidence: "medium",
    confidenceReason: "The expansion is direct; the capability breakdown is partially inferred from jobs.",
    updatedAt: "2026-07-10",
    sourceCount: 3,
    isDemo: true,
  },
  {
    slug: "orbit-media-engineering",
    name: "Orbit Media Engineering",
    city: "Bengaluru",
    industry: "Media technology",
    capabilities: ["Data & AI", "Product management"],
    hiringMomentum: "Growing",
    workplaceModel: "On-site",
    headcountBand: "201–500",
    launchedAt: "2025-05-14",
    summary: "An engineering centre for recommendations, advertising systems, and content operations.",
    latestEvent: "Announced ownership of a new recommendation quality programme.",
    activeJobs: 21,
    confidence: "medium",
    confidenceReason: "Two primary sources support the mandate; hiring totals change frequently.",
    updatedAt: "2026-07-16",
    sourceCount: 2,
    isDemo: true,
  },
  {
    slug: "quanta-supply-networks",
    name: "Quanta Supply Networks",
    city: "Hyderabad",
    industry: "Logistics technology",
    capabilities: ["Software engineering", "Data & AI"],
    hiringMomentum: "Steady",
    workplaceModel: "Hybrid",
    headcountBand: "101–200",
    launchedAt: "2025-09-25",
    summary: "A supply-chain technology centre building planning and network visibility products.",
    latestEvent: "Started recruiting for optimisation and data engineering roles.",
    activeJobs: 8,
    confidence: "medium",
    confidenceReason: "The source trail is recent but limited to two employer-controlled sources.",
    updatedAt: "2026-07-08",
    sourceCount: 2,
    isDemo: true,
  },
  {
    slug: "cobalt-aerospace-systems",
    name: "Cobalt Aerospace Systems",
    city: "Pune",
    industry: "Aerospace technology",
    capabilities: ["Embedded systems", "Quality engineering"],
    hiringMomentum: "Watch",
    workplaceModel: "On-site",
    headcountBand: "201–500",
    launchedAt: "2023-02-17",
    summary: "An engineering centre working on simulation, embedded software, and verification systems.",
    latestEvent: "No material expansion announcement observed in the latest review window.",
    activeJobs: 3,
    confidence: "limited",
    confidenceReason: "The centre is confirmed; current hiring activity has sparse recent evidence.",
    updatedAt: "2026-06-24",
    sourceCount: 1,
    isDemo: true,
  },
];

export type CompanyFilters = {
  query?: string;
  city?: string;
  capability?: string;
  momentum?: string;
};

export function filterCompanies(filters: CompanyFilters) {
  const query = filters.query?.trim().toLocaleLowerCase();
  return companies.filter((company) => {
    const searchable = [
      company.name,
      company.city,
      company.industry,
      company.summary,
      ...company.capabilities,
    ]
      .join(" ")
      .toLocaleLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (!filters.city || company.city === filters.city) &&
      (!filters.capability || company.capabilities.includes(filters.capability)) &&
      (!filters.momentum || company.hiringMomentum === filters.momentum)
    );
  });
}

export function findCompany(slug: string) {
  return companies.find((company) => company.slug === slug);
}

export const capabilities = [...new Set(companies.flatMap((company) => company.capabilities))].sort();
export const cities: City[] = ["Bengaluru", "Hyderabad", "Pune"];
