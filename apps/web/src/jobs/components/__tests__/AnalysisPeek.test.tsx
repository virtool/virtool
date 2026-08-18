import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { analysisServerFnMocks } from "@tests/server-fn/analyses";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import type { AnalysisMinimal } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import AnalysisPeek from "../AnalysisPeek";

describe("<AnalysisPeek />", () => {
	beforeEach(() => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
	});

	async function renderPeek(overrides?: Partial<AnalysisMinimal>) {
		const analysis = createFakeAnalysisMinimal({
			id: 9254,
			index: { id: 12, version: 3 },
			reference: { id: 41, name: "Plant Viruses" },
			sample: { id: 123, name: "Sample 123" },
			subtractions: [
				{ id: 5, name: "Arabidopsis", ready: true },
				{ id: 6, name: "Malus", ready: true },
			],
			...overrides,
		});

		analysisServerFnMocks.getAnalysisFn.mockResolvedValue(analysis);

		await renderWithRouter(<AnalysisPeek analysisId={analysis.id} />);

		return analysis;
	}

	it("links to the analysis, reference, index and subtractions", async () => {
		await renderPeek();

		expect(
			await screen.findByRole("link", { name: "Pathoscope" }),
		).toHaveAttribute("href", "/samples/123/analyses/9254");
		expect(screen.getByRole("link", { name: "Plant Viruses" })).toHaveAttribute(
			"href",
			"/refs/41",
		);
		expect(screen.getByRole("link", { name: "Index 3" })).toHaveAttribute(
			"href",
			"/refs/41/indexes/12",
		);
		expect(screen.getByRole("link", { name: "Arabidopsis" })).toHaveAttribute(
			"href",
			"/subtractions/5",
		);
		expect(screen.getByRole("link", { name: "Malus" })).toHaveAttribute(
			"href",
			"/subtractions/6",
		);
	});

	// The job's own state and steps are on the same page, so the analysis has no
	// business repeating them.
	it("shows no job state", async () => {
		await renderPeek({ ready: false });

		await screen.findByRole("link", { name: "Pathoscope" });
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
	});

	it("offers removal while the analysis is unfinished", async () => {
		await renderPeek({ ready: false });

		expect(
			await screen.findByRole("button", { name: "remove" }),
		).toBeInTheDocument();
	});

	it("withholds removal once the analysis is complete", async () => {
		await renderPeek({ ready: true });

		await screen.findByRole("link", { name: "Pathoscope" });
		await expect(
			screen.findByRole("button", { name: "remove" }),
		).rejects.toThrow();
	});

	it("withholds removal from a user who may not modify analyses", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: null }));

		await renderPeek({ ready: false });

		await screen.findByRole("link", { name: "Pathoscope" });
		await expect(
			screen.findByRole("button", { name: "remove" }),
		).rejects.toThrow();
	});
});
