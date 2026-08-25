import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import { cancelUpload, retryUpload } from "../../uploader";
import { UploaderItem, type UploaderItemProps } from "../UploaderItem";

vi.mock("../../uploader", () => ({
	cancelUpload: vi.fn(),
	retryUpload: vi.fn(),
}));

function renderItem(props: Partial<UploaderItemProps> = {}) {
	return renderWithProviders(
		<UploaderItem
			completed={false}
			failed={false}
			localId="a"
			name="reads.fq.gz"
			progress={40}
			size={1000}
			{...props}
		/>,
	);
}

describe("<UploaderItem />", () => {
	it("cancels an in-progress upload", async () => {
		renderItem();

		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(cancelUpload).toHaveBeenCalledWith("a");
	});

	it("shows the error message and retries or removes a failed upload", async () => {
		renderItem({ error: "A valid `name` is required.", failed: true });

		expect(screen.getByText("A valid `name` is required.")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(retryUpload).toHaveBeenCalledWith("a");

		await userEvent.click(screen.getByRole("button", { name: "Remove" }));
		expect(cancelUpload).toHaveBeenCalledWith("a");
	});

	it("falls back to a generic label when a failure carries no message", () => {
		renderItem({ failed: true });

		expect(screen.getByText("Failed")).toBeInTheDocument();
	});

	it("shows no cancel control once completed", () => {
		renderItem({ completed: true, progress: 100 });

		expect(
			screen.queryByRole("button", { name: "Cancel" }),
		).not.toBeInTheDocument();
	});
});
