import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import {
	mockCreateReferenceV2,
	mockGetReferenceV2,
	referenceV2ServerFnMocks,
} from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<CreateReferenceV2Form />", () => {
	it("creates a local Reference and navigates to its detail", async () => {
		const reference = createFakeReferenceV2({ name: "Plant Viruses" });

		const createReference = mockCreateReferenceV2(reference);
		mockGetReferenceV2(reference);

		const { router } = await renderRoute("/refs-v2");

		await userEvent.type(
			await screen.findByLabelText("Name", { exact: true }),
			"Plant Viruses",
		);
		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(router.state.location.pathname).toBe(`/refs-v2/${reference.id}`);
		});

		expect(await screen.findByText("Plant Viruses")).toBeInTheDocument();
		expect(createReference).toHaveBeenCalledTimes(1);
		expect(
			referenceV2ServerFnMocks.createReferenceV2Fn.mock.calls[0]?.[0],
		).toMatchObject({ data: { name: "Plant Viruses" } });
	});
});
