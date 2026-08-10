import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { screen } from "@testing-library/react";
import { expectNoViolations } from "@tests/axe";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { AnalysisMapping } from "../PathoscopeMapping";

const TOTAL_READS = 3217133;
const READ_COUNT = 28526;
const SUBTRACTED_COUNT = 4102;

function createAnalysis(
	overrides: Partial<FormattedPathoscopeAnalysis> = {},
): FormattedPathoscopeAnalysis {
	return {
		...createFakeAnalysisMinimal({
			id: 5,
			index: { id: 1, version: 3 },
			reference: { id: 2, name: "Plant Viruses" },
			subtractions: [{ id: 7, name: "Arabidopsis thaliana", ready: true }],
			workflow: "pathoscope",
		}),
		files: [],
		results: {
			hits: [],
			readCount: READ_COUNT,
			subtractedCount: SUBTRACTED_COUNT,
		},
		workflow: "pathoscope",
		...overrides,
	};
}

function row(label: string | RegExp) {
	return screen.getByText(label).closest("tr");
}

describe("<AnalysisMapping />", () => {
	it("should headline the reads that mapped before subtraction", async () => {
		await renderWithRouter(
			<AnalysisMapping detail={createAnalysis()} totalReads={TOTAL_READS} />,
		);

		expect(
			screen.getByRole("heading", {
				name: "1.01% of reads mapped to the reference",
			}),
		).toBeInTheDocument();

		expect(row("Total reads")).toHaveTextContent("3,217,133");
	});

	it("should subtract the removed reads from the mapped ones", async () => {
		await renderWithRouter(
			<AnalysisMapping detail={createAnalysis()} totalReads={TOTAL_READS} />,
		);

		expect(row("Plant Viruses")).toHaveTextContent("32,6281.01%");

		expect(row(/Subtracted, mapped better to/)).toHaveTextContent(
			"Arabidopsis thaliana−4,102−0.13%",
		);

		expect(row("Analysed")).toHaveTextContent("28,5260.89%");
	});

	it("should associate every figure with its row and column", async () => {
		const { container } = await renderWithRouter(
			<AnalysisMapping detail={createAnalysis()} totalReads={TOTAL_READS} />,
		);

		expect(screen.getByRole("columnheader", { name: "Reads" })).toBeVisible();
		expect(
			screen.getByRole("rowheader", { name: "Analysed" }),
		).toBeInTheDocument();

		await expectNoViolations(container);
	});

	it("should omit the subtraction breakdown when there are no subtractions", async () => {
		await renderWithRouter(
			<AnalysisMapping
				detail={createAnalysis({ subtractions: [] })}
				totalReads={TOTAL_READS}
			/>,
		);

		expect(
			screen.getByRole("heading", {
				name: "0.89% of reads mapped to the reference",
			}),
		).toBeInTheDocument();

		expect(screen.queryByText("Analysed")).toBeNull();
		expect(screen.queryByText(/Subtracted/)).toBeNull();
	});

	it("should drop the total and the percentages when the sample has no read count", async () => {
		await renderWithRouter(
			<AnalysisMapping detail={createAnalysis()} totalReads={0} />,
		);

		expect(
			screen.getByRole("heading", { name: "Mapped to the reference" }),
		).toBeInTheDocument();

		expect(screen.queryByText("Total reads")).toBeNull();
		expect(screen.queryByText(/%/)).toBeNull();
	});
});
