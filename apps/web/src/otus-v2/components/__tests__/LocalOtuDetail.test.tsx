import { screen } from "@testing-library/react";
import { createFakeLocalOtuV2 } from "@tests/fake/otusV2";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import { mockGetLocalOtuV2 } from "@tests/server-fn/otusV2";
import { mockGetReferenceV2 } from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { OtuV2IsolateNameType } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

describe("<LocalOtuDetail />", () => {
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
	const base = `/refs/beta/${reference.id}/otus/${otu.id}`;

	beforeEach(() => {
		mockGetReferenceV2(reference);
		mockGetLocalOtuV2(otu);
	});

	it("renders the header and OTU tab", async () => {
		await renderRoute(base);

		expect(
			await screen.findByText("Cucumber mosaic virus (CMV)", {
				exact: false,
			}),
		).toBeInTheDocument();
		expect(screen.getByText(otu.id)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "OTU" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Isolates" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "History" })).toBeInTheDocument();
	});

	it("previews five isolates on the OTU tab with a link to the rest", async () => {
		const isolates = Array.from({ length: 7 }, (_, index) => ({
			id: crypto.randomUUID(),
			name: {
				type: OtuV2IsolateNameType.isolate,
				value: `preview-${index}`,
			},
			sequences: [],
		}));
		const otuWithIsolates = createFakeLocalOtuV2({
			referenceId: reference.id,
			isolates,
		});
		mockGetLocalOtuV2(otuWithIsolates);

		await renderRoute(`/refs/beta/${reference.id}/otus/${otuWithIsolates.id}`);

		expect(await screen.findByText(/isolate preview-0/)).toBeInTheDocument();
		expect(screen.getByText(/isolate preview-4/)).toBeInTheDocument();
		expect(screen.queryByText(/isolate preview-5/)).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View 2 more isolates" }),
		).toBeInTheDocument();
	});

	it("renders isolates on the isolates tab", async () => {
		await renderRoute(`${base}/isolates`);

		expect(
			await screen.findByText(otu.isolates[0]?.sequences[0]?.sequence ?? ""),
		).toBeInTheDocument();
	});

	it("renders the change on the history tab", async () => {
		await renderRoute(`${base}/history`);

		expect(await screen.findByText(/CreateOTU/)).toBeInTheDocument();
	});
});
