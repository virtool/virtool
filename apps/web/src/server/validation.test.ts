import { describe, expect, it } from "vitest";
import { searchTermSchema } from "./validation";

describe("searchTermSchema", () => {
	it("should normalize surrounding search whitespace", () => {
		expect(searchTermSchema.parse("  alpha beta\t")).toBe("alpha beta");
	});

	it("should preserve whitespace between words", () => {
		expect(searchTermSchema.parse("alpha  beta")).toBe("alpha  beta");
	});

	it("should normalize whitespace-only terms to empty", () => {
		expect(searchTermSchema.parse(" \t ")).toBe("");
	});
});
