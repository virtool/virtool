import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeSubtractionMinimal } from "@tests/fake/subtractions";
import { mockFindSubtractions } from "@tests/server-fn/subtractions";
import { renderRoute } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<SubtractionList />", () => {
	let subtractions: ReturnType<typeof createFakeSubtractionMinimal>;

	beforeEach(() => {
		subtractions = createFakeSubtractionMinimal();
	});

	it("renders correctly", async () => {
		const findSubtractions = mockFindSubtractions([subtractions]);

		await renderRoute("/subtractions");

		expect(
			await screen.findByRole("heading", { name: /Subtractions/ }),
		).toBeInTheDocument();
		expect(screen.getByText("1")).toBeInTheDocument();
		expect(screen.getByText(subtractions.name)).toBeInTheDocument();

		expect(findSubtractions).toHaveBeenCalled();
	});

	it("should put the search term in the url once typing settles", async () => {
		mockFindSubtractions([subtractions]);

		const { router } = await renderRoute("/subtractions");

		const inputElement = await screen.findByPlaceholderText("Name");
		expect(inputElement).toHaveValue("");

		await userEvent.type(inputElement, "Foo");

		// The input tracks the draft immediately, ahead of the url.
		expect(inputElement).toHaveValue("Foo");

		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({
				term: "Foo",
			}),
		);
	});

	it("should render create button when [canModify=true]", async () => {
		const findSubtractions = mockFindSubtractions([subtractions]);
		const account = createFakeAccount({ administratorRole: "full" });

		await renderRoute("/subtractions", { account });

		expect(
			await screen.findByRole("button", { name: "Create" }),
		).toBeInTheDocument();

		expect(findSubtractions).toHaveBeenCalled();
	});

	it("should not render create button when [canModify=false]", async () => {
		const findSubtractions = mockFindSubtractions([subtractions]);
		const account = createFakeAccount({ administratorRole: null });

		await renderRoute("/subtractions", { account });

		expect(await screen.findByText(subtractions.name)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Create" })).toBeNull();

		expect(findSubtractions).toHaveBeenCalled();
	});
});
