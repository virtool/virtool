import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSample } from "@tests/fake/samples";
import { mockUpdateSample } from "@tests/server-fn/samples";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditSample from "../EditSample";

describe("<Editsample />", () => {
	let sample: ReturnType<typeof createFakeSample>;
	let props: ComponentProps<typeof EditSample>;

	beforeEach(() => {
		sample = createFakeSample();
		props = {
			sample,
			open: true,
			setOpen: vi.fn(),
		};
	});

	it("should render when [open=false]", async () => {
		props.open = false;

		await renderWithRouter(<EditSample {...props} />);

		expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
		expect(screen.queryByRole("textbox", { name: "Isolate" })).toBeNull();
		expect(screen.queryByRole("textbox", { name: "Host" })).toBeNull();
		expect(screen.queryByRole("textbox", { name: "Locale" })).toBeNull();
		expect(screen.queryByRole("textbox", { name: "Notes" })).toBeNull();
		expect(screen.queryByText("Save")).toBeNull();
	});

	it.each(["Name", "Isolate", "Host", "Locale", "Notes"])(
		"should render changed data for",
		async (inputLabel) => {
			await renderWithRouter(<EditSample {...props} />);

			const inputBox = screen.getByLabelText(inputLabel);
			expect(inputBox).toBeInTheDocument();
			const field = inputLabel.toLowerCase() as
				| "name"
				| "isolate"
				| "host"
				| "locale"
				| "notes";
			expect(inputBox).toHaveValue(sample[field]);

			await userEvent.clear(inputBox);
			expect(inputBox).toHaveValue("");

			await userEvent.type(inputBox, "test");
			expect(inputBox).toHaveValue("test");
		},
	);

	it("should update sample when form is submitted", async () => {
		const updateSample = mockUpdateSample(sample, {
			name: "newName",
			isolate: "newIsolate",
			host: "newHost",
			locale: "newLocale",
			notes: "newNotes",
		});
		await renderWithRouter(<EditSample {...props} />);

		const nameInput = screen.getByLabelText("Name");
		await userEvent.clear(nameInput);
		await userEvent.type(nameInput, "newName");

		const isolateInput = screen.getByLabelText("Isolate");
		await userEvent.clear(isolateInput);
		await userEvent.type(isolateInput, "newIsolate");

		const hostInput = screen.getByLabelText("Host");
		await userEvent.clear(hostInput);
		await userEvent.type(hostInput, "newHost");

		const localeInput = screen.getByLabelText("Locale");
		await userEvent.clear(localeInput);
		await userEvent.type(localeInput, "newLocale");

		const notesInput = screen.getByLabelText("Notes");
		await userEvent.clear(notesInput);
		await userEvent.type(notesInput, "newNotes");

		await userEvent.click(screen.getByText("Save"));
		await waitFor(() => expect(updateSample).toHaveBeenCalled());
	});
});
