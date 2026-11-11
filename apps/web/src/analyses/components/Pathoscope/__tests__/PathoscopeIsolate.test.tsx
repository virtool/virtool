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
