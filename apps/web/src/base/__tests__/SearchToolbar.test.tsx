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
			<SearchToolbar aria-label="Search things" onChange={onChange} value="" />,
		);

		await userEvent.type(screen.getByRole("textbox"), "Foo");

		await waitFor(() => expect(onChange).toHaveBeenCalledWith("Foo"));

		// Without debouncing this would have fired once per keystroke.
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("should show each keystroke immediately while the commit is deferred", async () => {
		renderWithProviders(
			<SearchToolbar aria-label="Search things" onChange={vi.fn()} value="" />,
		);

		const input = screen.getByRole("textbox");
		await userEvent.type(input, "Foo");

		expect(input).toHaveValue("Foo");
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

	it("should resync the input when the term changes externally", () => {
		const { rerender } = renderWithProviders(
			<SearchToolbar
				aria-label="Search things"
				onChange={vi.fn()}
				value="Foo"
			/>,
		);

		expect(screen.getByRole("textbox")).toHaveValue("Foo");

		rerender(
			<SearchToolbar aria-label="Search things" onChange={vi.fn()} value="" />,
		);

		expect(screen.getByRole("textbox")).toHaveValue("");
	});

	it("should not commit a stale term when cleared externally", async () => {
		const onChange = vi.fn();

		const { rerender } = renderWithProviders(
			<SearchToolbar
				aria-label="Search things"
				onChange={onChange}
				value="ferret"
			/>,
		);

		// Something outside the toolbar clears the term, as the samples filter bar
		// does. The pending draft must be abandoned rather than committed back.
		rerender(
			<SearchToolbar aria-label="Search things" onChange={onChange} value="" />,
		);

		await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));

		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole("textbox")).toHaveValue("");
	});

	it("should render the accessible name, placeholder, and trailing controls", () => {
		renderWithProviders(
			<SearchToolbar
				aria-label="Search things"
				onChange={vi.fn()}
				placeholder="Thing name"
				value=""
			>
				<Button>Create</Button>
			</SearchToolbar>,
		);

		expect(
			screen.getByRole("textbox", { name: "Search things" }),
		).toHaveAttribute("placeholder", "Thing name");
		expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
	});
});
