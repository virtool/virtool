import { describe, expect, it } from "vitest";
import { getSubtractionFastaName } from "./subtractions";

describe("getSubtractionFastaName()", () => {
	it("lowercases and replaces whitespace with underscores", () => {
		expect(getSubtractionFastaName("Arabidopsis thaliana")).toBe(
			"arabidopsis_thaliana.fa.gz",
		);
	});

	it("collapses runs of whitespace", () => {
		expect(getSubtractionFastaName("Foo  \tBar")).toBe("foo_bar.fa.gz");
	});
});
