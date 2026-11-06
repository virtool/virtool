import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  it("should write the month in full", () => {
    expect(formatDate("2026-11-04")).toBe("November 4, 2026");
  });
});
