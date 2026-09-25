import { AnalysisSearchProvider } from "@analyses/components/AnalysisSearchContext";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	createFakeAnalysisMinimal,
	createFakePathoscopeHit,
} from "@tests/fake/analyses";
import { renderWithProviders } from "@tests/setup";
import type { PathoscopeIsolate } from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PathoscopeExport from "../PathoscopeExport";

function createIsolate(
	overrides: Partial<PathoscopeIsolate>,
): PathoscopeIsolate {
	return {
		absentSegmentKeys: [],
		coverage: 0.5,
		depth: 12,
		id: "isolate",
		length: 6000,
		name: "Isolate A",
		pi: 0.25,
		sequences: [],
		...overrides,
	};
}

const analysis: FormattedPathoscopeAnalysis = {
	...createFakeAnalysisMinimal({ id: 5, workflow: "pathoscope" }),
	files: [],
	results: {
		hits: [
			createFakePathoscopeHit({
				id: "a",
				isolates: [
					createIsolate({ id: "a1", name: "Isolate A" }),
					createIsolate({
						coverage: 0.25,
						depth: 4,
						id: "a2",
						name: "Isolate B",
						pi: 0.1,
					}),
				],
				name: "Alpha virus",
			}),
			createFakePathoscopeHit({
				coverage: 0.25,
				depth: 7,
				id: "b",
				isolates: [createIsolate({ id: "b1", name: "Isolate C" })],
				name: "Beta virus",
				pi: 0.5,
			}),
		],
		readCount: 1000,
		subtractedCount: 0,
	},
	workflow: "pathoscope",
};

const writeText = vi.fn().mockResolvedValue(undefined);

function renderExport(search: Partial<AnalysisSearch> = {}) {
	renderWithProviders(
		<AnalysisSearchProvider
			search={{
				...DEFAULT_ANALYSIS_SEARCH,
				dir: "asc",
				...search,
			}}
			setSearch={vi.fn()}
		>
			<PathoscopeExport analysis={analysis} />
		</AnalysisSearchProvider>,
	);
}

async function openMenu() {
	await userEvent.click(screen.getByRole("button", { name: "Export" }));
}

beforeEach(() => {
	writeText.mockClear();

	vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
	vi.stubGlobal("isSecureContext", true);
});

describe("<PathoscopeExport />", () => {
	it("should offer a copy and a download section", async () => {
		renderExport();
		await openMenu();

		expect(screen.getByRole("group", { name: "Copy" })).toBeInTheDocument();
		expect(screen.getByRole("group", { name: "Download" })).toBeInTheDocument();

		expect(screen.getByRole("menuitem", { name: "Excel" })).toHaveAttribute(
			"href",
			"/analyses/documents/5.xlsx",
		);
		expect(screen.getByRole("menuitem", { name: "CSV" })).toHaveAttribute(
			"href",
			"/analyses/documents/5.csv",
		);
	});

	it("should copy the shown viruses as a tab-separated table", async () => {
		renderExport({ sort: "coverage" });
		await openMenu();
		await userEvent.click(screen.getByRole("menuitem", { name: "OTUs" }));

		expect(writeText).toHaveBeenCalledWith(
			[
				"Weight\tDepth\tCoverage\tName",
				"0.500\t7\t0.250\tBeta virus",
				"0.250\t12\t0.500\tAlpha virus",
			].join("\n"),
		);
	});

	it("should copy the isolates of every shown virus", async () => {
		renderExport({ sort: "coverage" });
		await openMenu();
		await userEvent.click(screen.getByRole("menuitem", { name: "Isolates" }));

		expect(writeText).toHaveBeenCalledWith(
			[
				"Weight\tDepth\tCoverage\tName\tIsolate",
				"0.250\t12\t0.500\tBeta virus\tIsolate C",
				"0.250\t12\t0.500\tAlpha virus\tIsolate A",
				"0.100\t4\t0.250\tAlpha virus\tIsolate B",
			].join("\n"),
		);
	});

	it("should leave the header row out when it is not wanted", async () => {
		renderExport({ find: "Beta" });
		await openMenu();
		await userEvent.click(
			screen.getByRole("menuitem", { name: "OTUs without headers" }),
		);

		expect(writeText).toHaveBeenCalledWith("0.500\t7\t0.250\tBeta virus");
	});

	it("should copy read pseudo-counts when reads are shown", async () => {
		renderExport({ find: "Alpha", reads: true });
		await openMenu();
		await userEvent.click(screen.getByRole("menuitem", { name: "OTUs" }));

		expect(writeText).toHaveBeenCalledWith(
			["Reads\tDepth\tCoverage\tName", "250\t12\t0.500\tAlpha virus"].join(
				"\n",
			),
		);
	});

	// The menu closes on a copy, so the trigger is the only place left to say it
	// happened.
	it("should report a copy on the trigger", async () => {
		renderExport();
		await openMenu();
		await userEvent.click(screen.getByRole("menuitem", { name: "OTUs" }));

		expect(
			await screen.findByRole("button", { name: "Copied" }),
		).toBeInTheDocument();
	});

	it("should offer downloads alone outside a secure context", async () => {
		vi.stubGlobal("isSecureContext", false);

		renderExport();
		await openMenu();

		expect(
			screen.queryByRole("group", { name: "Copy" }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: "Excel" })).toBeInTheDocument();
	});
});
