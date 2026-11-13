import { describe, expect, it } from "vitest";
import { drawSequencesChart } from "../Sequences";

describe("drawSequencesChart()", () => {
	it("should render an accessible chart with a data-informed label", () => {
		const element = document.createElement("div");

		drawSequencesChart(element, [5, 10, 3, 8], 600);

		const svg = element.querySelector("svg");

		expect(svg?.getAttribute("role")).toBe("img");
		expect(svg?.getAttribute("aria-label")).toBe(
			"Number of reads at each of 4 quality scores.",
		);
		expect(svg?.querySelector("title")?.textContent).toBe(
			svg?.getAttribute("aria-label"),
		);
	});
});
