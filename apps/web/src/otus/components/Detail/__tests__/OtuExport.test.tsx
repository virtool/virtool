import { downloadText } from "@app/download";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeOtuIsolate, createFakeOtuSequence } from "@tests/fake/otus";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OtuExport from "../OtuExport";

vi.mock("@app/download", () => ({ downloadText: vi.fn() }));

const otu = { name: "Tobacco mosaic virus", schema: [] };

const isolates = [
	createFakeOtuIsolate({
		default: true,
		sourceName: "A",
		sourceType: "isolate",
		sequences: [
			createFakeOtuSequence({
				accession: "MN1",
				definition: "Complete genome",
				host: "Tobacco",
				sequence: "ATGC",
			}),
		],
	}),
];

const writeText = vi.fn().mockResolvedValue(undefined);

async function renderExport() {
	await renderWithRouter(
		<OtuExport
			description="All 1 isolate"
			filenameParts={[otu.name]}
			includeIsolateTable
			isolates={isolates}
			otu={otu}
		/>,
	);
	await userEvent.click(screen.getByRole("button", { name: "Export" }));
}

function getGroupItem(group: string, name: string) {
	const element = screen.getByRole("group", { name: group });
	return Array.from(element.querySelectorAll('[role="menuitem"]')).find(
		(item) => item.textContent?.trim() === name,
	) as HTMLElement;
}

beforeEach(() => {
	writeText.mockClear();
	vi.mocked(downloadText).mockClear();
	mockGetAccount(
		createFakeAccount({
			settings: {
				...createFakeAccount().settings,
				referenceExportFastaHeader: "accession",
				referenceExportTableFormat: "csv",
			},
		}),
	);

	vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
	vi.stubGlobal("isSecureContext", true);
});

describe("<OtuExport />", () => {
	it("follows the account defaults and marks them", async () => {
		await renderExport();

		const accession = await screen.findByRole("menuitemradio", {
			name: /^Accession Default$/,
		});

		await waitFor(() => expect(accession).toBeChecked());
		expect(
			screen.getByRole("menuitemradio", { name: /^CSV Default$/ }),
		).toBeChecked();
	});

	it("copies FASTA with the header chosen in the menu", async () => {
		await renderExport();
		await waitFor(() =>
			expect(
				screen.getByRole("menuitemradio", { name: /^Accession Default$/ }),
			).toBeChecked(),
		);

		await userEvent.click(
			screen.getByRole("menuitemradio", {
				name: "Accession, OTU, and isolate",
			}),
		);
		await userEvent.click(getGroupItem("Copy", "FASTA"));

		expect(writeText).toHaveBeenCalledWith(
			">MN1|Tobacco mosaic virus|Isolate A\nATGC",
		);
	});

	it("copies tables as TSV whatever the download format", async () => {
		await renderExport();
		await userEvent.click(getGroupItem("Copy", "Isolate table"));

		expect(writeText).toHaveBeenCalledWith(
			"OTU\tIsolate\tDefault\tSequences\tAccessions\nTobacco mosaic virus\tIsolate A\tYes\t1\tMN1",
		);
	});

	it("downloads tables in the format chosen in the menu", async () => {
		await renderExport();
		await waitFor(() =>
			expect(
				screen.getByRole("menuitemradio", { name: /^CSV Default$/ }),
			).toBeChecked(),
		);

		await userEvent.click(screen.getByRole("menuitemradio", { name: "TSV" }));
		await userEvent.click(getGroupItem("Download", "Sequence table"));

		expect(downloadText).toHaveBeenCalledWith(
			expect.stringContaining("MN1\t\t4\tComplete genome\tTobacco"),
			"tobacco_mosaic_virus.sequences.tsv",
			"text/tab-separated-values",
		);
	});
});
