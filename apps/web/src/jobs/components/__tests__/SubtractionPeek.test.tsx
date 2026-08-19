import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeSubtraction } from "@tests/fake/subtractions";
import { mockGetSubtraction } from "@tests/server-fn/subtractions";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import type { Subtraction } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import SubtractionPeek from "../SubtractionPeek";

describe("<SubtractionPeek />", () => {
	beforeEach(() => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
	});

	async function renderPeek(overrides?: Partial<Subtraction>) {
		const subtraction = createFakeSubtraction({
			id: 5,
			name: "Arabidopsis",
			nickname: "Thale cress",
			...overrides,
		});

		mockGetSubtraction(subtraction);

		await renderWithRouter(<SubtractionPeek subtractionId={subtraction.id} />);

		return subtraction;
	}

	it("links to the subtraction and shows its nickname", async () => {
		await renderPeek();

		expect(
			await screen.findByRole("link", { name: "Arabidopsis" }),
		).toHaveAttribute("href", "/subtractions/5");
		expect(screen.getByText("Thale cress")).toBeInTheDocument();
	});

	// The job's own state and steps are on the same page, so the subtraction has
	// no business repeating them.
	it("shows no job state", async () => {
		await renderPeek({ ready: false });

		await screen.findByRole("link", { name: "Arabidopsis" });
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
	});
});
