import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import type { Coordinate } from "@virtool/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import PathoscopeOtuCoverage from "../PathoscopeOtuCoverage";

/**
 * jsdom does not lay out elements, so `offsetWidth` is always zero. The chart
 * measures its container to size the area, so stub a realistic width.
 */
function mockElementWidth(width: number) {
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(width);
}

const align: Coordinate[] = [
	[0, 0],
	[1, 5],
	[2, 12],
	[3, 3],
	[4, 0],
];

afterEach(() => {
	vi.restoreAllMocks();
});

describe("<PathoscopeOtuCoverage />", () => {
	it("should render an area path for the coverage polyline", () => {
		mockElementWidth(400);

		renderWithProviders(<PathoscopeOtuCoverage align={align} length={5} />);

		const path = screen.getByRole("img").querySelector("path");

		expect(path).not.toBeNull();
		expect(path?.getAttribute("d")).toMatch(/^M0,60L/);
	});

	it("should render no path when the container has not been measured", () => {
		mockElementWidth(0);

		renderWithProviders(<PathoscopeOtuCoverage align={align} length={5} />);

		expect(screen.getByRole("img").querySelector("path")).toBeNull();
	});

	it("should render no path when the OTU recorded no coverage", () => {
		mockElementWidth(400);

		renderWithProviders(<PathoscopeOtuCoverage align={[]} length={0} />);

		expect(screen.getByRole("img").querySelector("path")).toBeNull();
	});

	it("should draw no more points than the container has pixels", () => {
		mockElementWidth(50);

		// A dense curve, with a peak in the middle of the column the 50px container
		// leaves for it.
		const dense: Coordinate[] = Array.from({ length: 5000 }, (_, index) => [
			index,
			index === 2510 ? 900 : index % 7,
		]);

		renderWithProviders(<PathoscopeOtuCoverage align={dense} length={5000} />);

		const d =
			screen.getByRole("img").querySelector("path")?.getAttribute("d") ?? "";

		// The area path repeats each point on the way back along the baseline.
		const points = [...d.matchAll(/[ML]([\d.]+),/g)].length / 2;

		expect(points).toBeLessThanOrEqual(50);

		// The peak is what the column reports, so it still reaches the top of the
		// chart.
		expect(d).toContain(",0L");
	});

	it("should scale the polyline across the full genome length", () => {
		mockElementWidth(400);

		// The polyline stops well short of the genome it spans, which is what a
		// simplified curve does. The chart must scale to the genome rather than to
		// the last point it was given.
		renderWithProviders(
			<PathoscopeOtuCoverage
				align={[
					[0, 0],
					[100, 8],
				]}
				length={200}
			/>,
		);

		const d =
			screen.getByRole("img").querySelector("path")?.getAttribute("d") ?? "";

		const xValues = [...d.matchAll(/[ML]([\d.]+),/g)].map((match) =>
			Number(match[1]),
		);

		// 100 of 200 positions is half the 400px container.
		expect(Math.max(...xValues)).toBe(200);
	});
});
