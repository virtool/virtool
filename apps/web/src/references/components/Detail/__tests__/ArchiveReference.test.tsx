import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeReference } from "@tests/fake/references";
import {
	mockArchiveReference,
	mockUnarchiveReference,
	referenceServerFnMocks,
} from "@tests/server-fn/references";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import ArchiveReference from "../ArchiveReference";

function getDialogTitle(verb: "Archive" | "Unarchive", name: string) {
	return screen.queryByRole("heading", {
		name: `${verb} ${name}?`,
	});
}

describe("<ArchiveReference />", () => {
	it("should archive an active reference and close the dialog on success", async () => {
		const detail = createFakeReference({ archived: false });
		mockArchiveReference({ ...detail, archived: true });

		await renderWithRouter(<ArchiveReference detail={detail} />);

		await userEvent.click(screen.getByRole("button", { name: "archive" }));
		expect(getDialogTitle("Archive", detail.name)).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Archive" }));

		await waitFor(() => {
			expect(getDialogTitle("Archive", detail.name)).toBeNull();
		});

		expect(referenceServerFnMocks.archiveReferenceFn).toHaveBeenCalledWith({
			data: { referenceId: detail.id },
		});
	});

	it("should unarchive an archived reference", async () => {
		const detail = createFakeReference({ archived: true });
		mockUnarchiveReference({ ...detail, archived: false });

		await renderWithRouter(<ArchiveReference detail={detail} />);

		await userEvent.click(screen.getByRole("button", { name: "unarchive" }));
		expect(getDialogTitle("Unarchive", detail.name)).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Unarchive" }));

		await waitFor(() => {
			expect(getDialogTitle("Unarchive", detail.name)).toBeNull();
		});

		expect(referenceServerFnMocks.unarchiveReferenceFn).toHaveBeenCalledWith({
			data: { referenceId: detail.id },
		});
	});

	it("should surface the server error message when the mutation fails", async () => {
		const detail = createFakeReference({ archived: false });
		referenceServerFnMocks.archiveReferenceFn.mockRejectedValue(
			new Error("Reference not found."),
		);

		await renderWithRouter(<ArchiveReference detail={detail} />);

		await userEvent.click(screen.getByRole("button", { name: "archive" }));
		await userEvent.click(screen.getByRole("button", { name: "Archive" }));

		expect(await screen.findByText("Reference not found.")).toBeInTheDocument();
		expect(getDialogTitle("Archive", detail.name)).toBeInTheDocument();
	});

	it("should fall back to a generic message when the error has none", async () => {
		const detail = createFakeReference({ archived: false });
		referenceServerFnMocks.archiveReferenceFn.mockRejectedValue(new Error(""));

		await renderWithRouter(<ArchiveReference detail={detail} />);

		await userEvent.click(screen.getByRole("button", { name: "archive" }));
		await userEvent.click(screen.getByRole("button", { name: "Archive" }));

		expect(
			await screen.findByText(/Failed to archive reference/i),
		).toBeInTheDocument();
	});

	it("should close without mutating when the Cancel button is clicked", async () => {
		const detail = createFakeReference({ archived: false });
		mockArchiveReference(detail);

		await renderWithRouter(<ArchiveReference detail={detail} />);

		await userEvent.click(screen.getByRole("button", { name: "archive" }));
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(getDialogTitle("Archive", detail.name)).toBeNull();
		});
		expect(referenceServerFnMocks.archiveReferenceFn).not.toHaveBeenCalled();
	});
});
