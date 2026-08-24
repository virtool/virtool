import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { expect, it, vi } from "vitest";
import { InputHeader } from "../Input";

it("<InputHeader />", async () => {
	const value = "Hello";
	const onSubmit = vi.fn();

	const { getByRole } = renderWithProviders(
		<InputHeader id="name" value={value} onSubmit={onSubmit} />,
	);

	const input = getByRole("textbox");
	expect(input).toHaveValue(value);

	// Reacts to typing.
	await userEvent.type(input, " world");
	expect(input).toHaveValue("Hello world");
	expect(onSubmit).not.toHaveBeenCalled();

	// Submits on loss of focus.
	await userEvent.click(document.body);
	expect(onSubmit).toHaveBeenLastCalledWith("Hello world");

	// Submits on press enter.
	await userEvent.type(input, " again");
	expect(input).toHaveValue("Hello world again");
	await userEvent.keyboard("{Enter}");
	expect(onSubmit).toHaveBeenCalledTimes(2);
	expect(onSubmit).toHaveBeenLastCalledWith("Hello world again");
});
