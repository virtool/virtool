import { describe, expect, it } from "vitest";
import { drawBasesChart } from "../Bases";

describe("drawBasesChart()", () => {
	it("should render an accessible chart with a data-informed label", () => {
		const element = document.createElement("div");
		const data = [
			[30, 31, 28, 33, 26, 35],
			[31, 32, 29, 34, 27, 36],
			[29, 30, 27, 32, 25, 34],
		];

		drawBasesChart(element, data, 600);

		const svg = element.querySelector("svg");

		expect(svg?.getAttribute("role")).toBe("img");
		expect(svg?.getAttribute("aria-label")).toBe(
			"Base quality distribution across 3 read positions, showing mean and median quality with interquartile and interdecile ranges.",
		);
		expect(svg?.querySelector("title")?.textContent).toBe(
			svg?.getAttribute("aria-label"),
		);
	});
});
