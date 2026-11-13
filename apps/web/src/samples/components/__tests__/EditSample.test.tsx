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

	it("should show the current values and submit the edited ones", async () => {
		const updateSample = mockUpdateSample(sample, {
			name: "newName",
			isolate: "newIsolate",
			host: "newHost",
			locale: "newLocale",
			notes: "newNotes",
		});
		await renderWithRouter(<EditSample {...props} />);

		expect(screen.getByLabelText("Name")).toHaveValue(sample.name);
		expect(screen.getByLabelText("Isolate")).toHaveValue(sample.isolate);
		expect(screen.getByLabelText("Host")).toHaveValue(sample.host);
		expect(screen.getByLabelText("Locale")).toHaveValue(sample.locale);
		expect(screen.getByLabelText("Notes")).toHaveValue(sample.notes);

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
		await waitFor(() =>
			expect(updateSample).toHaveBeenCalledWith({
				data: {
					sampleId: sample.id,
					name: "newName",
					isolate: "newIsolate",
					host: "newHost",
					locale: "newLocale",
					notes: "newNotes",
				},
			}),
		);
	});
});
