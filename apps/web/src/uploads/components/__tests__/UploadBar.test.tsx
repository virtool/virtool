import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import { UploadBar } from "../UploadBar";

/**
 * Drag a file over an element the way a browser does: the drag-and-drop spec
 * withholds file data until drop, so the event carries bare DataTransferItems
 * with a MIME type but no name.
 */
function dragEnter(element: HTMLElement) {
	fireEvent.dragEnter(element, {
		dataTransfer: {
			items: [{ kind: "file", type: "application/gzip" }],
			types: ["Files"],
		},
	});
}

/**
 * Drop files the way a browser does: `dataTransfer` carries both the items and
 * the files, and react-dropzone reads the file data off the items.
 */
function drop(element: HTMLElement, files: File[]) {
	fireEvent.drop(element, {
		dataTransfer: {
			files,
			items: files.map((file) => ({
				getAsFile: () => file,
				kind: "file",
				type: file.type,
			})),
			types: ["Files"],
		},
	});
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
