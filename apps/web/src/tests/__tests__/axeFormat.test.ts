import type { Result } from "axe-core";
import { describe, expect, it } from "vitest";
import { formatViolations } from "../axe";

describe("formatViolations", () => {
	it("formats multiple nodes, unknown impact, and multi-line summaries", () => {
		const violations = [
			{
				id: "image-alt",
				impact: null,
				help: "Images must have alternate text",
				helpUrl: "https://example.com/image-alt",
				nodes: [
					{
						html: "<img src=first>",
						failureSummary: "Fix any of the following:\n  Element has no alt",
					},
					{ html: "<img src=second>" },
				],
			},
		] as unknown as Result[];

		const output = formatViolations(violations);

		// Unknown impact falls back to "unknown".
		expect(output).toContain("image-alt (unknown):");
		// Every offending node appears.
		expect(output).toContain("<img src=first>");
		expect(output).toContain("<img src=second>");
		// The multi-line failure summary is indented under its node.
		expect(output).toContain(
			"    Fix any of the following:\n      Element has no alt",
		);
	});
});
