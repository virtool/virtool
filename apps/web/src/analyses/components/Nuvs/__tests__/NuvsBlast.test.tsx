import NuvsBlast from "@analyses/components/Nuvs/NuvsBlast";
import type { Blast } from "@analyses/types";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeFormattedNuVsHit } from "@tests/fake/analyses";
import { mockBlastNuvs } from "@tests/server-fn/analyses";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

function createBlast(overrides: Partial<Blast>): Blast {
	return {
		createdAt: new Date("2026-07-01T00:00:00.000Z"),
		error: null,
		id: 1,
		interval: 3,
		lastCheckedAt: new Date("2026-07-01T00:00:00.000Z"),
		ready: false,
		result: null,
		rid: null,
		sequenceIndex: 0,
		updatedAt: new Date("2026-07-01T00:00:00.000Z"),
		...overrides,
	};
}

function renderBlast(blast?: Blast) {
	const hit = createFakeFormattedNuVsHit({ blast, index: 0 });

	return renderWithProviders(<NuvsBlast analysisId={5} hit={hit} />);
}

describe("<NuvsBlast />", () => {
	it("should offer to start a request when the contig has no blast", async () => {
		const blastNuvs = mockBlastNuvs(0);

		renderBlast();

		expect(
			screen.getByText(
				"This sequence has no BLAST information attached to it.",
			),
		).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "BLAST at NCBI" }),
		);

		expect(blastNuvs).toHaveBeenCalledWith({
			data: { analysisId: 5, sequenceIndex: 0 },
		});
	});

	it("should render the error and retry a failed request", async () => {
		const blastNuvs = mockBlastNuvs(0);

		renderBlast(createBlast({ error: "Failure. BLAST did not work." }));

		expect(screen.getByText("Error during BLAST request.")).toBeInTheDocument();
		expect(
			screen.getByText("Failure. BLAST did not work."),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Retry" }));

		expect(blastNuvs).toHaveBeenCalled();
	});

	it("should show the RID while a request is in progress", () => {
		renderBlast(createBlast({ rid: "ABC123" }));

		expect(screen.getByText("BLAST in progress")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /ABC123/ })).toHaveAttribute(
			"href",
			expect.stringContaining("RID=ABC123"),
		);
	});

	it("should render a row per hit when the request has returned", () => {
		renderBlast(
			createBlast({
				ready: true,
				result: {
					hits: [
						{
							accession: "NC_001498",
							align_len: 200,
							bit_score: 40,
							evalue: 1e-20,
							gaps: 0,
							identity: 150,
							len: 200,
							name: "Measles virus",
							score: 88,
							taxid: 11234,
							title: "Measles",
						},
					],
					masking: [],
					params: {},
					program: "blastn",
					stat: {},
					target: {},
					version: "2.0",
					rid: "ABC123",
					updated_at: "2026-07-01T00:00:00.000Z",
				},
			}),
		);

		expect(screen.getByRole("link", { name: "NC_001498" })).toBeInTheDocument();
		expect(screen.getByText("Measles virus")).toBeInTheDocument();
		// 150 of 200 aligned positions, formatted to two decimals.
		expect(screen.getByText("0.75")).toBeInTheDocument();
	});

	it("should say so when the request returned nothing", () => {
		renderBlast(createBlast({ ready: true, result: null }));

		expect(screen.getByText("No BLAST hits found.")).toBeInTheDocument();
	});
});
