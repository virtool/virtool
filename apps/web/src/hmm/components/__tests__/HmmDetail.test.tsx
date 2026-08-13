import { screen } from "@testing-library/react";
import { createFakeHmm } from "@tests/fake/hmm";
import { mockGetHmm, mockGetHmmError } from "@tests/server-fn/hmm";
import { at, renderRoute } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<HmmDetail />", () => {
	const hmmDetail = createFakeHmm();
	let path: string;

	beforeEach(() => {
		path = `/hmms/${hmmDetail.id}`;
	});

	describe("<HmmDetail />", () => {
		it("should render correctly when query has an error", async () => {
			mockGetHmmError(404);
			await renderRoute(path);

			expect(await screen.findByText("404")).toBeInTheDocument();
			expect(screen.getByText("Not found")).toBeInTheDocument();
		});

		it.each([
			["a legacy Mongo id", "abc123"],
			["zero", "0"],
			["a negative id", "-1"],
			["an id beyond the safe integer range", "9007199254740993"],
		])(
			"should render not found when the path carries %s",
			async (_label, segment) => {
				await renderRoute(`/hmms/${segment}`);

				expect(await screen.findByText("404")).toBeInTheDocument();
				expect(screen.getByText("Not found")).toBeInTheDocument();
			},
		);

		it("should render loading when props.detail = null", async () => {
			await renderRoute(path);

			expect(screen.getByLabelText("loading")).toBeInTheDocument();
			expect(screen.queryByText("Cluster Members")).not.toBeInTheDocument();
		});

		it("should render details correctly", async () => {
			mockGetHmm(hmmDetail);
			await renderRoute(path);

			expect(await screen.findByText("Cluster")).toBeInTheDocument();
			expect(screen.getByText(hmmDetail.cluster)).toBeInTheDocument();

			expect(screen.getByText("Names")).toBeInTheDocument();

			expect(screen.getByText("Length")).toBeInTheDocument();
			expect(screen.getByText(hmmDetail.length)).toBeInTheDocument();

			expect(screen.getByText("Mean Entropy")).toBeInTheDocument();
			expect(screen.getByText(hmmDetail.meanEntropy)).toBeInTheDocument();
		});

		it("should render Cluster table correctly", async () => {
			mockGetHmm(hmmDetail);
			await renderRoute(path);

			expect(await screen.findByText("Cluster Members")).toBeInTheDocument();
			expect(screen.getByText(hmmDetail.entries.length)).toBeInTheDocument();

			const firstEntry = at(hmmDetail.entries, 0);
			const secondEntry = at(hmmDetail.entries, 1);

			expect(screen.getByText("Accession")).toBeInTheDocument();
			expect(screen.getByText(firstEntry.accession)).toBeInTheDocument();
			expect(screen.getByText(secondEntry.accession)).toBeInTheDocument();

			expect(screen.getByText("Name")).toBeInTheDocument();
			expect(screen.getByText(firstEntry.name)).toBeInTheDocument();
			expect(screen.getByText(secondEntry.name)).toBeInTheDocument();

			expect(screen.getByText("Organism")).toBeInTheDocument();
			expect(screen.queryByText(firstEntry.organism)).toBeInTheDocument();
			expect(screen.queryByText(secondEntry.organism)).toBeInTheDocument();
		});
	});

	describe("HmmTaxonomy", () => {
		it("should render Families correctly", async () => {
			mockGetHmm(hmmDetail);
			await renderRoute(path);

			expect(await screen.findByText("Families")).toBeInTheDocument();

			expect(screen.getByText("Papillomaviridae")).toBeInTheDocument();
			expect(
				screen.getByText(hmmDetail.families.Papillomaviridae),
			).toBeInTheDocument();
			expect(screen.getByText("None")).toBeInTheDocument();
			expect(screen.getByText(hmmDetail.families.None)).toBeInTheDocument();
		});

		it("should render Genera correctly", async () => {
			mockGetHmm(hmmDetail);
			await renderRoute(path);

			expect(await screen.findByText("Genera")).toBeInTheDocument();

			expect(screen.getByText("Begomovirus")).toBeInTheDocument();
			expect(
				screen.getByText(hmmDetail.genera.Begomovirus),
			).toBeInTheDocument();
			expect(screen.getByText("Curtovirus")).toBeInTheDocument();
			expect(screen.getByText(hmmDetail.genera.Curtovirus)).toBeInTheDocument();
		});
	});
});
