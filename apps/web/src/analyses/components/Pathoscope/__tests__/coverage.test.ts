import type { Coordinate } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import {
	buildDepthPath,
	type CoveragePanel,
	downsample,
	formatDepth,
	layOutPanels,
	type Panel,
	showsLength,
} from "../coverage";

function xValuesOf(d: string): number[] {
	return [...d.matchAll(/[ML]([\d.]+),/g)].map((match) => Number(match[1]));
}

function panel(length: number, overrides: Partial<CoveragePanel> = {}) {
	return {
		align: null,
		key: `len:${length}`,
		label: "",
		length,
		lengthLabel: "",
		...overrides,
	};
}

describe("downsample()", () => {
	it("should return a polyline that already fits unchanged", () => {
		const align: Coordinate[] = [
			[0, 1],
			[1, 2],
		];

		expect(downsample(align, 2, 10)).toBe(align);
	});

	it("should keep the deepest point in each column", () => {
		// A dense curve, with a peak in the middle of one of the 50 columns.
		const dense: Coordinate[] = Array.from({ length: 5000 }, (_, index) => [
			index,
			index === 2510 ? 900 : index % 7,
		]);

		const points = downsample(dense, 5000, 50);

		expect(points).toHaveLength(50);
		expect(points).toContainEqual([2510, 900]);
		expect(points.map(([x]) => x)).toEqual(
			points.map(([x]) => x).toSorted((a, b) => a - b),
		);
	});
});

describe("buildDepthPath()", () => {
	it("should start at the baseline and reach the ceiling at the peak", () => {
		const d = buildDepthPath(
			[
				[0, 0],
				[2, 12],
				[4, 0],
			],
			5,
			400,
			12,
			80,
		);

		expect(d).toMatch(/^M0,80L/);
		expect(d).toContain(",0L");
	});

	it("should draw no more points than the width has pixels", () => {
		const dense: Coordinate[] = Array.from({ length: 5000 }, (_, index) => [
			index,
			index % 7,
		]);

		// The area path repeats each point on the way back along the baseline.
		expect(
			xValuesOf(buildDepthPath(dense, 5000, 50, 900, 80)).length / 2,
		).toBeLessThanOrEqual(50);
	});

	it("should scale the polyline across the full segment length", () => {
		// The polyline stops well short of the genome it spans, which is what a
		// simplified curve does. The path scales to the segment, not to the last
		// point it was given.
		const d = buildDepthPath(
			[
				[0, 0],
				[100, 8],
			],
			200,
			400,
			8,
			80,
		);

		expect(Math.max(...xValuesOf(d))).toBe(200);
	});

	it("should draw against the shared depth, not its own peak", () => {
		// A curve that peaks at a fifth of the shared depth is drawn a fifth as tall.
		expect(buildDepthPath([[0, 20]], 10, 400, 100, 80)).toMatch(/^M[\d.]+,64/);
	});
});

describe("layOutPanels()", () => {
	it("should lay out nothing when the panels span no length", () => {
		expect(layOutPanels([], 400)).toEqual([]);
	});

	it("should size each panel by its share of the reference", () => {
		// 414px less the two 4px gutters and one 6px gap leaves 400px.
		const [first, second] = layOutPanels([panel(300), panel(100)], 414);

		expect(first?.width).toBe(300);
		expect(second?.width).toBe(100);
	});

	it("should give the gutter to the outermost panels, not to the box", () => {
		// A panel's hover styling covers its own padding, so the gutter has to
		// belong to a panel. Held on the box, it leaves a strip inside the border
		// that stays unhighlighted while the panel beside it is hovered.
		expect(
			layOutPanels([panel(300), panel(100)], 414).map(
				({ padLeft, padRight }) => [padLeft, padRight],
			),
		).toEqual([
			[4, 0],
			[0, 4],
		]);
	});
});

function laidOut(overrides: Partial<Panel>): Panel {
	return {
		...panel(3400, { label: "L", lengthLabel: "3,400 nt" }),
		padLeft: 0,
		padRight: 0,
		width: 200,
		...overrides,
	};
}

describe("showsLength()", () => {
	it.each<[string, Partial<Panel>, number, boolean]>([
		["show the length of a wide panel", { width: 200 }, 16, true],
		["drop the length of a narrow panel", { width: 97 }, 16, false],
		// Dropping it would leave the caption blank, which reads as a gap.
		[
			"keep a narrow panel's length when it has no label",
			{ label: "", width: 97 },
			16,
			true,
		],
		// The bar is in rem, so it doubles with the caption instead of letting it
		// overrun the panel.
		["raise the bar as the reader's text grows", { width: 200 }, 32, false],
		["show nothing when there is no length", { lengthLabel: "" }, 16, false],
	])("should %s", (_, overrides, rootFontSize, expected) => {
		expect(showsLength(laidOut(overrides), rootFontSize)).toBe(expected);
	});
});

describe("formatDepth()", () => {
	it.each([
		[12, "12"],
		[999, "999"],
		[1000, "1k"],
		[1240, "1.2k"],
		[1_500_000, "1.5M"],
	])("should format %d as %s", (depth, expected) => {
		expect(formatDepth(depth)).toBe(expected);
	});
});
