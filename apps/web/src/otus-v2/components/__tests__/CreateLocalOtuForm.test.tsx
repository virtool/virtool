import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeLocalOtuV2 } from "@tests/fake/otusV2";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import {
	mockCreateLocalOtuV2,
	otuV2ServerFnMocks,
} from "@tests/server-fn/otusV2";
import { mockGetReferenceV2 } from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<CreateLocalOtuForm />", () => {
	it("creates a complete OTU, navigates to its UUID, and renders the detail", async () => {
		const reference = createFakeReferenceV2();
		const otu = createFakeLocalOtuV2({
			referenceId: reference.id,
			taxonomy: {
				kind: "local",
				identityId: crypto.randomUUID(),
				name: "Tobacco mosaic virus",
				acronym: "TMV",
				lineage: [],
			},
		});

		mockGetReferenceV2(reference);
		const createLocalOtu = mockCreateLocalOtuV2(otu);

		const { router } = await renderRoute(`/refs/beta/${reference.id}/otus/new`);

		await userEvent.type(
			await screen.findByLabelText("Name", { exact: true }),
			"Tobacco mosaic virus",
		);
		await userEvent.type(
			screen.getByLabelText("Sequence definition"),
			"Complete genome",
		);
		await userEvent.type(screen.getByLabelText("Sequence"), "ATCGAT");

		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(router.state.location.pathname).toBe(
				`/refs/beta/${reference.id}/otus/${otu.id}`,
			);
		});

		// The detail renders the read model the create returned, not the form input.
		expect(
			await screen.findByText("Tobacco mosaic virus (TMV)", { exact: false }),
		).toBeInTheDocument();
		expect(screen.getByText(otu.id)).toBeInTheDocument();

		// One complete command reached the server: canonical envelope, client UUID,
		// and a create expectation of version 0.
		expect(createLocalOtu).toHaveBeenCalledTimes(1);
		const call = otuV2ServerFnMocks.createLocalOtuFn.mock.calls[0]?.[0];
		expect(call.data.referenceId).toBe(reference.id);
		expect(call.data.command).toMatchObject({
			type: "CreateOTU",
			schemaVersion: 1,
			expectedVersion: 0,
		});
		expect(call.data.command.otuId).toMatch(/^[0-9a-f-]{36}$/);
		expect(call.data.command.payload.isolate.sequences[0].segmentId).toBe(
			call.data.command.payload.plan.segments[0].id,
		);
		expect(call.data.command.payload.plan.segments[0].length).toBe(6);
	});
});
