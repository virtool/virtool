import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import {
	mockDeleteReferenceV2,
	mockGetReferencesV2,
	mockGetReferenceV2,
	referenceV2ServerFnMocks,
} from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";

import { describe, expect, it } from "vitest";

describe("<DeleteReferenceV2 />", () => {
	it("confirms deletion and returns to the v2 Reference list", async () => {
		const reference = createFakeReferenceV2({ name: "Delete me" });
		mockGetReferenceV2(reference);
		mockDeleteReferenceV2();
		mockGetReferencesV2([]);

		const { router } = await renderRoute(
			`/refs/alpha/${reference.id}/settings`,
		);
		await userEvent.click(
			await screen.findByRole("button", { name: "Delete reference" }),
		);
		expect(
			screen.getByRole("alertdialog", { name: "Delete Reference" }),
		).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		expect(referenceV2ServerFnMocks.deleteReferenceV2Fn).toHaveBeenCalledWith({
			data: { referenceId: reference.id },
		});
		expect(router.state.location.pathname).toBe("/refs/alpha");
	});
});
