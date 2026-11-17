import NuvsValues from "@analyses/components/Nuvs/NuvsValues";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("<NuvsValues />", () => {
	it("uses the singular for one ORF", () => {
		render(<NuvsValues e={0.5} orfCount={1} />);

		expect(screen.getByText("1 ORF")).toBeInTheDocument();
		expect(screen.getByText("E = 0.5")).toBeInTheDocument();
	});

	it("uses the plural for several ORFs and leaves out a missing e-value", () => {
		render(<NuvsValues e={null} orfCount={2} />);

		expect(screen.getByText("2 ORFs")).toBeInTheDocument();
		expect(screen.queryByText(/E =/)).not.toBeInTheDocument();
	});
});
