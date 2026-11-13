import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import NuvsSequence from "../NuvsSequence";

describe("<NuvsSequence />", () => {
	it("should render an accessible ruler with a data-informed label", () => {
		renderWithProviders(
			<div style={{ width: 400 }}>
				<NuvsSequence maxSequenceLength={20} sequence="ATCGATCG" />
			</div>,
		);

		const svg = screen.getByRole("img");

		expect(svg.getAttribute("aria-label")).toBe(
			"Sequence ruler: a 8 nucleotide sequence on a scale up to 20 nucleotides.",
		);
		expect(svg.querySelector("title")?.textContent).toBe(
			svg.getAttribute("aria-label"),
		);
	});
});
