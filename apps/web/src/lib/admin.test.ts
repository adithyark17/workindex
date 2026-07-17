import { describe, expect, it } from "vitest";
import {
  evidenceReviewFixtures,
  filterReviewItems,
  filterRuns,
  filterSources,
  findReviewItem,
  ingestionRunFixtures,
  sourceRegistryFixtures,
} from "./admin";

describe("admin fixture read models", () => {
  it("keeps every fixture explicitly demo-only", () => {
    for (const record of [...sourceRegistryFixtures, ...ingestionRunFixtures, ...evidenceReviewFixtures]) {
      expect(record.isDemo).toBe(true);
    }
  });

  it("never exposes blocked sources as active", () => {
    expect(filterSources("", "active").every((source) => source.status === "active")).toBe(true);
    expect(filterSources("", "blocked")).toHaveLength(2);
  });

  it("searches runs by correlation ID and filters status", () => {
    expect(filterRuns("corr_01J2MZ8NG6R4")[0]?.status).toBe("failed");
    expect(filterRuns("", "blocked").map((run) => run.id)).toEqual(["run-20260716-1800"]);
  });

  it("filters and selects review evidence", () => {
    expect(filterReviewItems("taxonomy", "escalated").map((item) => item.id)).toEqual(["ev-003"]);
    expect(findReviewItem("ev-001")?.fieldName).toBe("mandate_summary");
    expect(findReviewItem("missing")).toBeUndefined();
  });
});

