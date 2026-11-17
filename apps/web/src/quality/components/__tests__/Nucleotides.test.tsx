import { describe, expect, it } from "vitest";
import { drawNucleotidesChart } from "../Nucleotides";

describe("drawNucleotidesChart()", () => {
	it("should render an accessible chart with a data-informed label", () => {
		const element = document.createElement("div");
		const data: Array<[number, number, number, number]> = [
			[10, 20, 30, 40],
			[15, 25, 30, 30],
		];

		drawNucleotidesChart(element, data, 600);

		const svg = element.querySelector("svg");

		expect(svg?.getAttribute("role")).toBe("img");
		expect(svg?.getAttribute("aria-label")).toBe(
			"Nucleotide composition across 2 read positions, showing the percentage of guanine, adenine, thymine, and cytosine.",
		);
		expect(svg?.querySelector("title")?.textContent).toBe(
			svg?.getAttribute("aria-label"),
		);
	});
});
