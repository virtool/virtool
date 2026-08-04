import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import type {
	PathoscopeSegmentCoverage,
	PathoscopeSequence,
} from "@virtool/contracts";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import PathoscopeIsolate from "../PathoscopeIsolate";

/**
 * jsdom does not lay out elements, so `offsetWidth` is always zero. The chart
 * measures its container to size the area, so stub a realistic width.
 */
function mockElementWidth(width: number) {
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(width);
}

function segment(
	key: string,
	length: number,
	name: string | null,
	detected = true,
): PathoscopeSegmentCoverage {
	return { align: [], detected, key, length, name };
}

function sequence(
	segmentKey: string,
	accession: string,
	length: number,
): PathoscopeSequence {
	return {
		accession,
		align: [
			[0, 5],
			[length, 5],
		],
		best: 10,
		coverage: 1,
		definition: `${accession} definition`,
		id: accession,
		length,
		pi: 0.5,
		reads: 20,
		segmentKey,
	};
}

const segments = [
	segment("seg:L", 8900, "L"),
	segment("seg:M", 4800, "M"),
	segment("seg:S", 2900, "S"),
];

function render(children: ReactNode) {
	renderWithProviders(
		<AnalysisSearchProvider
			search={DEFAULT_ANALYSIS_SEARCH}
			setSearch={vi.fn()}
		>
			{children}
		</AnalysisSearchProvider>,
	);
}

function renderIsolate(
	sequences: PathoscopeSequence[],
	absentSegmentKeys: string[] = [],
) {
	render(
		<PathoscopeIsolate
			absentSegmentKeys={absentSegmentKeys}
			coverage={0.9}
			depth={12}
			maxDepth={20}
			name="Isolate A"
			pi={0.5}
			reads={30}
			segments={segments}
			sequences={sequences}
		/>,
	);
}

describe("<PathoscopeIsolate />", () => {
	it("should label a named segment's panel with the segment's name, not the sequence's accession", () => {
		mockElementWidth(400);

		renderIsolate([
			sequence("seg:L", "NC_L", 8900),
			sequence("seg:M", "NC_M", 4800),
			sequence("seg:S", "NC_S", 2900),
		]);

		expect(
			screen.getByRole("group", { name: /Read depth across each/ }),
		).toBeVisible();
		expect(screen.getByText("L")).toBeVisible();
		expect(screen.getByText("M")).toBeVisible();
		expect(screen.getByText("S")).toBeVisible();
		expect(screen.queryByText("NC_L")).toBeNull();
		expect(screen.queryByText(/not in this isolate/)).toBeNull();
	});

	it("should carry each panel's own sequence length, exactly", () => {
		mockElementWidth(1200);

		// The sequence's length, not the segment's, which is as long as the longest
		// sequence any isolate filled it with.
		renderIsolate([
			sequence("seg:L", "NC_L", 8700),
			sequence("seg:M", "NC_M", 4800),
			sequence("seg:S", "NC_S", 2900),
		]);

		expect(screen.getByText("8,700 nt")).toBeVisible();
		expect(screen.getByText("4,800 nt")).toBeVisible();
		expect(screen.getByText("2,900 nt")).toBeVisible();
	});

	it("should give no length to a panel the isolate has no sequence for", () => {
		mockElementWidth(1200);

		renderIsolate(
			[sequence("seg:L", "NC_L", 8900), sequence("seg:S", "NC_S", 2900)],
			["seg:M"],
		);

		expect(screen.getByText("M · not in this isolate")).toBeVisible();
		expect(screen.queryByText("4,800 nt")).toBeNull();
	});

	it("should fall back to the accession when the segment has no schema name", () => {
		mockElementWidth(400);

		render(
			<PathoscopeIsolate
				absentSegmentKeys={[]}
				coverage={0.9}
				depth={12}
				maxDepth={20}
				name="Isolate A"
				pi={0.5}
				reads={30}
				segments={[segment("len:8900", 8900, null)]}
				sequences={[sequence("len:8900", "NC_X", 8900)]}
			/>,
		);

		expect(screen.getByText("NC_X")).toBeVisible();
	});

	it("should hold the panel open for a segment the isolate does not carry", () => {
		mockElementWidth(400);

		// No M sequence. The panel has to stay in place, or L and S would read as
		// though they were the isolate's first two segments.
		renderIsolate(
			[sequence("seg:L", "NC_L", 8900), sequence("seg:S", "NC_S", 2900)],
			["seg:M"],
		);

		expect(screen.getByText("M · not in this isolate")).toBeVisible();
	});

	it("should not claim the isolate lacks a segment it carries but nothing mapped to", () => {
		mockElementWidth(400);

		// M is missing from `sequences` because it took no reads, not because the
		// isolate lacks it — the two are indistinguishable from the hits alone, and
		// the server says which by leaving M off `absentSegmentKeys`. Another isolate
		// having mapped to M is no evidence either way, so `detected` must not decide
		// this.
		renderIsolate([sequence("seg:L", "NC_L", 8900)], ["seg:S"]);

		expect(screen.getByText("M · no reads")).toBeVisible();
		expect(screen.queryByText("M · not in this isolate")).toBeNull();
		expect(screen.getByText("S · not in this isolate")).toBeVisible();
	});

	it("should not claim the isolate lacks a segment nothing mapped to", () => {
		mockElementWidth(400);

		// Every isolate is empty on a segment no hit was recorded against, and the
		// reference may well describe it for all of them — so the label must not say
		// this isolate does not carry it.
		render(
			<PathoscopeIsolate
				absentSegmentKeys={[]}
				coverage={0.9}
				depth={12}
				maxDepth={20}
				name="Isolate A"
				pi={0.5}
				reads={30}
				segments={[
					segment("seg:L", 8900, "L"),
					segment("seg:M", 4800, "M", false),
				]}
				sequences={[sequence("seg:L", "NC_L", 8900)]}
			/>,
		);

		expect(screen.getByText("M · no reads")).toBeVisible();
		expect(screen.queryByText("M · not in this isolate")).toBeNull();
	});

	it("should not claim the isolate lacks a length-inferred segment", () => {
		mockElementWidth(400);

		// A bin is derived from the sequences that were hit, so an unhit sequence has
		// no bin to fall in and the server can place no isolate in or out of one. The
		// label has to hold whichever it is.
		render(
			<PathoscopeIsolate
				absentSegmentKeys={[]}
				coverage={0.9}
				depth={12}
				maxDepth={20}
				name="Isolate A"
				pi={0.5}
				reads={30}
				segments={[segment("len:0", 8900, null), segment("len:1", 2900, null)]}
				sequences={[sequence("len:0", "NC_X", 8900)]}
			/>,
		);

		expect(screen.getByText("Segment · no reads")).toBeVisible();
		expect(screen.queryByText(/not in this isolate/)).toBeNull();
	});

	it("should reveal a sequence's figures in a popover when its panel is clicked", async () => {
		mockElementWidth(400);

		renderIsolate([sequence("seg:L", "NC_L", 8900)]);

		// The whole panel is the trigger, curve included, not just the caption
		// beneath it.
		await userEvent.click(
			screen.getByRole("button", { name: "L sequence details" }),
		);

		expect(await screen.findByRole("link", { name: "NC_L" })).toHaveAttribute(
			"href",
			"https://www.ncbi.nlm.nih.gov/nuccore/NC_L",
		);
		expect(screen.getByText("NC_L definition")).toBeVisible();
		expect(
			screen.getByRole("rowheader", { name: "Coverage" }).nextSibling,
		).toHaveTextContent("1.000");
		expect(
			screen.getByRole("rowheader", { name: "Length" }).nextSibling,
		).toHaveTextContent("8,900 nt");
	});

	it("should not make a panel the isolate has no sequence for a trigger", () => {
		mockElementWidth(400);

		renderIsolate([sequence("seg:L", "NC_L", 8900)]);

		expect(
			screen.queryByRole("button", { name: /M · not in this isolate/ }),
		).toBeNull();
	});

	it("should show the isolate's figures in the same columns as the otu's", () => {
		mockElementWidth(400);

		renderIsolate([sequence("seg:L", "NC_L", 8900)]);

		// The labels are only drawn in the OTU's row, so the isolate's carry them
		// for assistive technology alone — but the columns themselves have to match.
		expect(screen.getByText("Weight").previousSibling).toHaveTextContent(
			"0.500",
		);
		expect(screen.getByText("Depth").previousSibling).toHaveTextContent("12");
		expect(screen.getByText("Coverage").previousSibling).toHaveTextContent(
			"0.900",
		);
	});

	it("should render nothing but the heading for an isolate with no segments", () => {
		render(
			<PathoscopeIsolate
				absentSegmentKeys={[]}
				coverage={0}
				depth={0}
				maxDepth={0}
				name="Isolate A"
				pi={0}
				reads={0}
				segments={[]}
				sequences={[]}
			/>,
		);

		expect(screen.queryByRole("group")).toBeNull();
		expect(screen.getByRole("heading", { name: "Isolate A" })).toBeVisible();
	});
});
