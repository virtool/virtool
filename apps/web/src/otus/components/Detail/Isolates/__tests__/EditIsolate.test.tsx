import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockUpdateIsolate, otuServerFnMocks } from "@tests/server-fn/otus";
import { renderWithProviders } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditIsolate from "../EditIsolate";

describe("<EditIsolate />", () => {
	let props: ComponentProps<typeof EditIsolate>;

	beforeEach(() => {
		props = {
			allowedSourceTypes: ["isolate", "genotype"],
			isolateId: "isolate",
			onHide: vi.fn(),
			otuId: "otu",
			restrictSourceTypes: false,
			show: true,
			sourceName: "A",
			sourceType: "isolate",
		};
	});

	async function submitSourceName(sourceName: string) {
		const input = screen.getByRole("textbox", { name: "Source Name" });
		await userEvent.clear(input);
		await userEvent.type(input, sourceName);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
	}

	it("should close the dialog after the save succeeds", async () => {
		const updateIsolate = mockUpdateIsolate({ sourceName: "B" });
		renderWithProviders(<EditIsolate {...props} />);

		await submitSourceName("B");

		await waitFor(() => expect(props.onHide).toHaveBeenCalled());
		expect(updateIsolate).toHaveBeenCalledWith({
			data: {
				otuId: "otu",
				isolateId: "isolate",
				sourceName: "B",
				sourceType: "Isolate",
			},
		});
	});

	it("should stay open and show the error when the save fails", async () => {
		otuServerFnMocks.updateIsolateFn.mockRejectedValue(
			new Error("Source name already exists"),
		);
		renderWithProviders(<EditIsolate {...props} />);

		await submitSourceName("B");

		expect(
			await screen.findByText("Source name already exists"),
		).toBeInTheDocument();
		expect(props.onHide).not.toHaveBeenCalled();
		expect(screen.getByRole("textbox", { name: "Source Name" })).toHaveValue(
			"B",
		);
	});
});
