import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import NuvsOrf from "../NuvsOrf";

describe("<NuvsOrf />", () => {
	it("should render an accessible glyph describing the reading frame", () => {
		renderWithProviders(
			<div style={{ width: 400 }}>
				<NuvsOrf
					hits={[]}
					maxSequenceLength={1000}
					pos={[340, 920]}
					strand={-1}
				/>
			</div>,
		);

		const svg = screen.getByRole("img");

		expect(svg.getAttribute("aria-label")).toBe(
			"Open reading frame from position 340 to 920 on the reverse strand.",
		);
		expect(svg.querySelector("title")?.textContent).toBe(
			svg.getAttribute("aria-label"),
		);
	});
});
