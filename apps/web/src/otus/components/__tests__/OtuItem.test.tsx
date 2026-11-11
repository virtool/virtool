import { screen } from "@testing-library/react";
import { createFakeOtuMinimal } from "@tests/fake/otus";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import OtuItem from "../OtuItem";

describe("<OtuItem />", () => {
	it("links to the OTU and marks it unverified", async () => {
		const otu = createFakeOtuMinimal({ verified: false });

		await renderWithRouter(<OtuItem {...otu} refId="ref-1" />);

		expect(screen.getByRole("link", { name: otu.name })).toHaveAttribute(
			"href",
			`/refs/ref-1/otus/${otu.id}`,
		);
		expect(screen.getByText(otu.acronym)).toBeInTheDocument();
		expect(screen.getByText("Unverified")).toBeInTheDocument();
	});
});
