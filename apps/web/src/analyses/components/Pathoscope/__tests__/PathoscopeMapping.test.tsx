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
	it("should headline the mapped reads, subtract the removed ones, and associate every figure with its row and column", async () => {
		const { container } = await renderWithRouter(
			<AnalysisMapping detail={createAnalysis()} totalReads={TOTAL_READS} />,
		);

		expect(
			screen.getByRole("heading", {
				name: "1.01% of reads mapped to the reference",
			}),
		).toBeInTheDocument();

		expect(row("Total reads")).toMatchTextContent("3,217,133");
		expect(row("Plant Viruses")).toMatchTextContent("32,6281.01%");
		expect(row(/Subtracted, mapped better to/)).toMatchTextContent(
			"Arabidopsis thaliana−4,102−0.13%",
		);
		expect(row("Analysed")).toMatchTextContent("28,5260.89%");

		expect(screen.getByRole("columnheader", { name: "Reads" })).toBeVisible();
		expect(
			screen.getByRole("rowheader", { name: "Analysed" }),
		).toBeInTheDocument();

		await expectNoViolations(container);
	});

	it("should not sign the subtracted row when nothing was subtracted", async () => {
		await renderWithRouter(
			<AnalysisMapping
				detail={createAnalysis({
					results: { hits: [], readCount: READ_COUNT, subtractedCount: 0 },
				})}
				totalReads={TOTAL_READS}
			/>,
		);

		expect(row(/Subtracted, mapped better to/)).toMatchTextContent(
			"Arabidopsis thaliana00.00%",
		);
	});

	it("should show a share below 0.01% as <0.01%", async () => {
		await renderWithRouter(
			<AnalysisMapping
				detail={createAnalysis({
					results: { hits: [], readCount: READ_COUNT, subtractedCount: 12 },
				})}
				totalReads={TOTAL_READS}
			/>,
		);

		expect(row(/Subtracted, mapped better to/)).toMatchTextContent(
			"Arabidopsis thaliana−12<0.01%",
		);
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
