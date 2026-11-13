import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import Button from "../Button";
import SearchToolbar from "../SearchToolbar";

describe("<SearchToolbar />", () => {
	it("should commit the term once the user stops typing", async () => {
		const onChange = vi.fn();

		renderWithProviders(
			<SearchToolbar
				aria-label="Search things"
				onChange={onChange}
				placeholder="Thing name"
				value=""
			>
				<Button>Create</Button>
			</SearchToolbar>,
		);

		const input = screen.getByRole("textbox", { name: "Search things" });

		expect(input).toHaveAttribute("placeholder", "Thing name");
		expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();

		await userEvent.type(input, "Foo");

		expect(input).toHaveValue("Foo");
		await waitFor(() => expect(onChange).toHaveBeenCalledWith("Foo"));

		// Without debouncing this would have fired once per keystroke.
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("should keep a trailing space so the user can continue typing", async () => {
		const onChange = vi.fn();

		renderWithProviders(
			<SearchToolbar aria-label="Search things" onChange={onChange} value="" />,
		);

		const input = screen.getByRole("textbox");
		await userEvent.type(input, "Foo ");
		await waitFor(() => expect(onChange).toHaveBeenCalledWith("Foo "));

		await userEvent.type(input, "Bar");

		expect(input).toHaveValue("Foo Bar");
		await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("Foo Bar"));
	});
});
