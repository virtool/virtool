import { screen } from "@testing-library/react";
import { createFakeLocalOtuV2 } from "@tests/fake/otusV2";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import { mockGetLocalOtuV2 } from "@tests/server-fn/otusV2";
import { mockGetReferenceV2 } from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<LocalOtuDetail />", () => {
	it("assembles and renders the OTU from the detail read", async () => {
		const reference = createFakeReferenceV2();
		const otu = createFakeLocalOtuV2({
			referenceId: reference.id,
			taxonomy: {
				kind: "local",
				identityId: crypto.randomUUID(),
				name: "Cucumber mosaic virus",
				acronym: "CMV",
			},
		});

		mockGetReferenceV2(reference);
		mockGetLocalOtuV2(otu);

		await renderRoute(`/refs-v2/${reference.id}/otus/${otu.id}`);

		expect(
			await screen.findByText("Cucumber mosaic virus (CMV)", {
				exact: false,
			}),
		).toBeInTheDocument();
		expect(screen.getByText(otu.id)).toBeInTheDocument();
		expect(screen.getByText(`Version ${otu.version}`)).toBeInTheDocument();
		expect(
			screen.getByText(otu.isolates[0]?.sequences[0]?.sequence ?? ""),
		).toBeInTheDocument();
		expect(screen.getByText(/CreateOTU/)).toBeInTheDocument();
	});
});
