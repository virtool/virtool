import { describe, expect, it } from "vitest";
import { normalizeSearchTerm } from "../search";

describe("normalizeSearchTerm()", () => {
	it("should remove surrounding whitespace", () => {
		expect(normalizeSearchTerm("  alpha beta\t")).toBe("alpha beta");
	});

	it("should preserve whitespace between words", () => {
		expect(normalizeSearchTerm("alpha  beta")).toBe("alpha  beta");
	});

	it("should normalize whitespace-only terms to empty", () => {
		expect(normalizeSearchTerm(" \t ")).toBe("");
	});
});
