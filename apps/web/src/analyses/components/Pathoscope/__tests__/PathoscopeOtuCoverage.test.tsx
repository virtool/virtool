import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import type { Coordinate, PathoscopeSegmentCoverage } from "@virtool/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import PathoscopeOtuCoverage from "../PathoscopeOtuCoverage";

/**
 * jsdom does not lay out elements, so `offsetWidth` is always zero. The chart
 * measures its container to size the area, so stub a realistic width.
 */
function mockElementWidth(width: number) {
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(width);
}

function segment(
	align: Coordinate[],
	length: number,
	name: string | null = null,
): PathoscopeSegmentCoverage {
	return {
		align,
		detected: align.length > 0,
		key: name === null ? `len:${length}` : `seg:${name}`,
		length,
		name,
	};
}

const align: Coordinate[] = [
	[0, 0],
	[1, 5],
	[2, 12],
	[3, 3],
	[4, 0],
];

const single = [segment(align, 5)];

function paths(): SVGPathElement[] {
	return [...screen.getByRole("img").querySelectorAll("path")];
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("<PathoscopeOtuCoverage />", () => {
	it("should render an area path for the coverage polyline", () => {
		mockElementWidth(400);

		renderWithProviders(
			<PathoscopeOtuCoverage maxDepth={12} segments={single} />,
		);

		const [path] = paths();

		expect(path).not.toBeUndefined();
		expect(path?.getAttribute("d")).toMatch(/^M0,80L/);
	});

	it("should render no path when the container has not been measured", () => {
		mockElementWidth(0);

		renderWithProviders(
			<PathoscopeOtuCoverage maxDepth={12} segments={single} />,
		);

		expect(paths()).toHaveLength(0);
	});

	it("should rule every panel and label the ceiling once for the chart", () => {
		mockElementWidth(414);

		const { container } = renderWithProviders(
			<PathoscopeOtuCoverage
				maxDepth={1240}
				segments={[segment(align, 300, "L"), segment(align, 100, "S")]}
			/>,
		);

		const rules = [...container.querySelectorAll("line")];

		// The rule sits at the top of the curve area, so a curve reaching the
		// ceiling meets it rather than running off the top of the panel.
		expect(rules).toHaveLength(2);
		expect(rules.map((rule) => rule.getAttribute("y1"))).toEqual([
			"0.5",
			"0.5",
		]);
		expect(rules.map((rule) => rule.getAttribute("y2"))).toEqual([
			"0.5",
			"0.5",
		]);
		expect(rules.map((rule) => rule.getAttribute("x2"))).toEqual([
			"300",
			"100",
		]);

		// The label is drawn over the chart, so it is hidden from the name the
		// chart carries, which spells the figure out instead.
		expect(screen.getByText("1.2k")).toBeVisible();
		expect(screen.getByRole("img")).toHaveAccessibleName(/peak depth of 1240$/);
	});

	it("should draw no ceiling for an OTU nothing mapped to", () => {
		mockElementWidth(400);

		// There is no depth to rule the chart at, and a line along the top would
		// read as one.
		const { container } = renderWithProviders(
			<PathoscopeOtuCoverage
				maxDepth={0}
				segments={[{ ...segment(align, 300, "L"), detected: false, align: [] }]}
			/>,
		);

		expect(container.querySelectorAll("line")).toHaveLength(0);
		expect(screen.getByRole("img")).toHaveAccessibleName(
			"Read depth across the reference genome",
		);
	});

	it("should caption each segment with its name, then its length", () => {
		mockElementWidth(1000);

		renderWithProviders(
			<PathoscopeOtuCoverage
				maxDepth={12}
				segments={[segment(align, 3760, "RNA 1"), segment(align, 800)]}
			/>,
		);

		// The caption is a flex row, so its spacing is gap rather than text.
		expect(screen.getByText("RNA 1").parentElement).toHaveTextContent(
			"RNA 1·3,760 nt",
		);

		// A segment matched by length has no name; its length identifies it.
		expect(screen.getByText("800 nt")).toBeVisible();
	});

	it("should say why a segment nothing mapped to is blank", () => {
		mockElementWidth(400);

		renderWithProviders(
			<PathoscopeOtuCoverage
				maxDepth={12}
				segments={[
					segment(align, 3400, "L"),
					{ align: [], detected: false, key: "seg:M", length: 1200, name: "M" },
				]}
			/>,
		);

		// The panel keeps its place in the layout but draws nothing, so the label has
		// to carry the reason — a blank panel alone reads as a gap.
		expect(paths()).toHaveLength(1);
		expect(screen.getByText("M · no reads")).toBeVisible();
	});

	it("should carry the length but not the name of an unsegmented otu's segment", () => {
		mockElementWidth(400);

		// The name would only repeat what the accordion above already says.
		renderWithProviders(
			<PathoscopeOtuCoverage
				maxDepth={12}
				segments={[segment(align, 5000, "L")]}
			/>,
		);

		expect(screen.getByText("5,000 nt")).toBeVisible();
		expect(screen.queryByText("L")).toBeNull();
	});

	it("should fix the label row's height rather than let its content set it", () => {
		mockElementWidth(400);

		// Every chart has to be the same total height whatever its captions say, or
		// the two read as different components rather than one in two states.
		const { container } = renderWithProviders(
			<PathoscopeOtuCoverage maxDepth={12} segments={[segment(align, 5000)]} />,
		);

		const labelRow = container.querySelector(".text-gray-600.text-sm");

		expect(labelRow).not.toBeNull();

		// In rem, so it grows with the reader's font-size preference.
		expect((labelRow as HTMLElement).style.height).toBe("1.125rem");
	});

	it("should left-justify segment labels", () => {
		mockElementWidth(400);

		renderWithProviders(
			<PathoscopeOtuCoverage
				maxDepth={12}
				segments={[segment(align, 3400, "L"), segment(align, 800)]}
			/>,
		);

		expect(screen.getByText("L").className).toContain("text-left");
	});
});
