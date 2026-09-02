import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import {
	mockArchiveReferenceV2,
	mockGetReferenceV2,
	mockUnarchiveReferenceV2,
	referenceV2ServerFnMocks,
} from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<ArchiveReferenceV2 />", () => {
	it("archives an active Reference", async () => {
		const reference = createFakeReferenceV2({ archived: false });
		mockGetReferenceV2(reference);
		mockArchiveReferenceV2({ ...reference, archived: true });
		await renderRoute(`/refs/alpha/${reference.id}/settings`);

		await userEvent.click(
			await screen.findByRole("button", { name: "Archive reference" }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Archive" }));

		expect(referenceV2ServerFnMocks.archiveReferenceV2Fn).toHaveBeenCalledWith({
			data: { referenceId: reference.id },
		});
		await waitFor(() => {
			expect(screen.queryByRole("dialog")).toBeNull();
		});
	});

	it("unarchives an archived Reference", async () => {
		const reference = createFakeReferenceV2({ archived: true });
		mockGetReferenceV2(reference);
		mockUnarchiveReferenceV2({ ...reference, archived: false });
		await renderRoute(`/refs/alpha/${reference.id}/settings`);

		await userEvent.click(
			await screen.findByRole("button", { name: "Unarchive reference" }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Unarchive" }));

		expect(
			referenceV2ServerFnMocks.unarchiveReferenceV2Fn,
		).toHaveBeenCalledWith({ data: { referenceId: reference.id } });
	});
});
