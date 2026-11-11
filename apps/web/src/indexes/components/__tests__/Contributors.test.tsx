import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import Contributors from "../Contributors";

describe("<Contributors />", () => {
	it("should render", () => {
		const props = {
			contributors: [
				{ id: 987, username: "bill", count: 22 },
				{ id: 123, username: "bob", count: 5 },
				{ id: 456, username: "linda", count: 12 },
			],
		};

		renderWithProviders(<Contributors {...props} />);

		const bill = screen.getByText("bill");

		expect(bill).toBeInTheDocument();
		expect(bill).toHaveTextContent("22 changes");

		const bob = screen.getByText("bob");

		expect(bob).toBeInTheDocument();
		expect(bob).toHaveTextContent("5 changes");

		const linda = screen.getByText("linda");

		expect(linda).toBeInTheDocument();
		expect(linda).toHaveTextContent("12 changes");
	});
});
