import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./pagination";

describe("bounded cursor pagination", () => {
  it("round trips an offset without exposing it directly", () => {
    const cursor = encodeCursor(50);
    expect(cursor).not.toBe("50");
    expect(decodeCursor(cursor)).toBe(50);
  });

  it("fails invalid cursors closed to the first page", () => {
    expect(decodeCursor("not-a-cursor")).toBe(0);
    expect(decodeCursor(null)).toBe(0);
  });
});
