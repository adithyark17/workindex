import { describe, expect, it } from "vitest";
import { companies, filterCompanies, findCompany } from "./workindex";

describe("WorkIndex fixture contracts", () => {
  it("retains provenance metadata for every demo company", () => {
    expect(companies).toHaveLength(12);
    for (const company of companies) {
      expect(company.isDemo).toBe(true);
      expect(company.sourceCount).toBeGreaterThan(0);
      expect(company.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(company.confidenceReason.length).toBeGreaterThan(20);
    }
  });

  it("composes directory filters", () => {
    const results = filterCompanies({
      city: "Hyderabad",
      capability: "Data & AI",
      momentum: "Growing",
    });
    expect(results.map((company) => company.slug)).toEqual([
      "astera-health-systems",
      "solace-energy-digital",
    ]);
  });

  it("searches name, city, industry, capability, and summary", () => {
    expect(filterCompanies({ query: "cybersecurity" })).toHaveLength(2);
    expect(filterCompanies({ query: "healthcare" })[0]?.slug).toBe("astera-health-systems");
  });

  it("returns undefined for unknown slugs", () => {
    expect(findCompany("does-not-exist")).toBeUndefined();
  });
});
