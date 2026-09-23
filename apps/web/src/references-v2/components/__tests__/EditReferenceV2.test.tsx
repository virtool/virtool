import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import {
	mockGetReferenceV2,
	referenceV2ServerFnMocks,
} from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<EditReferenceV2 />", () => {
	it("submits metadata with the observed version", async () => {
		const reference = createFakeReferenceV2({
			version: 3,
			name: "Original",
			description: "Old",
		});
		mockGetReferenceV2(reference);
		referenceV2ServerFnMocks.updateReferenceV2Fn.mockResolvedValueOnce({
			...reference,
			name: "Updated",
			description: "New",
			defaultSegmentLengthTolerance: 0.1,
			version: 4,
		});
		await renderRoute(`/refs/alpha/${reference.id}/settings`, {
			account: createFakeAccount({ administratorRole: "full" }),
		});
		await userEvent.clear(await screen.findByLabelText("Name"));
		await userEvent.type(screen.getByLabelText("Name"), "Updated");
		await userEvent.clear(screen.getByLabelText("Description"));
		await userEvent.type(screen.getByLabelText("Description"), "New");
		await userEvent.clear(
			screen.getByLabelText("Default segment length tolerance"),
		);
		await userEvent.type(
			screen.getByLabelText("Default segment length tolerance"),
			"0.1",
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(referenceV2ServerFnMocks.updateReferenceV2Fn).toHaveBeenCalledWith(
				{
					data: {
						referenceId: reference.id,
						update: {
							name: "Updated",
							description: "New",
							defaultSegmentLengthTolerance: 0.1,
							expectedVersion: 3,
						},
					},
				},
			),
		);
	});

	it("does not offer saving an archived Reference", async () => {
		const reference = createFakeReferenceV2({ archived: true });
		mockGetReferenceV2(reference);
		await renderRoute(`/refs/alpha/${reference.id}/settings`);
		expect(await screen.findByLabelText("Name")).toBeDisabled();
		expect(
			screen.queryByRole("button", { name: "Save" }),
		).not.toBeInTheDocument();
	});
});
