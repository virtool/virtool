import { act, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import { UploadBar } from "../UploadBar";

/**
 * Dispatch a drag event that carries `files`. Testing Library's `fireEvent`
 * copies only the own properties of a `DataTransfer`, and a real one has none.
 */
function dispatchDrag(element: HTMLElement, type: string, files: File[]) {
	const dataTransfer = new DataTransfer();

	for (const file of files) {
		dataTransfer.items.add(file);
	}

	act(() => {
		element.dispatchEvent(
			new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }),
		);
	});
}

/**
 * Drag a file whose name fails the regex over an element. A browser withholds
 * file names until the drop, so the drag must not be rejected.
 */
function dragEnter(element: HTMLElement) {
	const file = new File(["test"], "invalid.gz", { type: "application/gzip" });
	dispatchDrag(element, "dragenter", [file]);
}

function drop(element: HTMLElement, files: File[]) {
	dispatchDrag(element, "drop", files);
}

function getBar() {
	return screen.getByLabelText("Upload file").parentElement as HTMLElement;
}

describe("<UploadBar>", () => {
	it("should not reject a drag when the file name is not yet readable", async () => {
		renderWithProviders(
			<UploadBar onDrop={vi.fn()} regex={/\.f(ast)?q(\.gz)?$/} />,
		);

		const bar = getBar();
		dragEnter(bar);

		await waitFor(() => {
			expect(bar).toHaveClass("bg-blue-100");
		});
		expect(bar).not.toHaveClass("bg-red-100");
	});

	it("should reject a dropped file whose name fails the regex", async () => {
		const onDrop = vi.fn();

		renderWithProviders(
			<UploadBar onDrop={onDrop} regex={/\.f(ast)?q(\.gz)?$/} />,
		);

		const invalid = new File(["test"], "invalid.gz", {
			type: "application/gzip",
		});

		drop(getBar(), [invalid]);

		expect(
			await screen.findByText("Invalid file names: invalid.gz"),
		).toBeInTheDocument();
	});
});
