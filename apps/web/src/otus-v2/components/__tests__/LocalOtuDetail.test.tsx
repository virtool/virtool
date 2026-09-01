import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
			lineage: [],
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
		expect(screen.queryByText(`OTU ${otu.id}`)).not.toBeInTheDocument();
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

	it("links preview isolates to their detail views", async () => {
		await renderRoute(base);

		const isolate = otu.isolates[0];
		expect(
			await screen.findByRole("link", {
				name: `${isolate?.name?.type} ${isolate?.name?.value}`,
			}),
		).toHaveAttribute("href", `${base}/isolates/${isolate?.id}`);
	});

	it("links lineage names to NCBI taxonomy", async () => {
		const otuWithLineage = createFakeLocalOtuV2({
			referenceId: reference.id,
			taxonomy: {
				kind: "local",
				identityId: crypto.randomUUID(),
				name: "Cucumber mosaic virus",
				acronym: "CMV",
				lineage: [
					{ id: 10239, name: "Viruses", rank: "superkingdom" },
					{ id: 12242, name: "Cucumber mosaic virus", rank: "species" },
				],
			},
		});
		mockGetLocalOtuV2(otuWithLineage);

		await renderRoute(`/refs/beta/${reference.id}/otus/${otuWithLineage.id}`);

		expect(
			await screen.findByRole("button", { name: "Show higher taxa" }),
		).toHaveAttribute("aria-expanded", "false");
		expect(
			screen.queryByRole("link", { name: "Viruses" }),
		).not.toBeInTheDocument();
		expect(
			screen
				.getAllByRole("link", { name: "Cucumber mosaic virus" })
				.find((link) => link.getAttribute("href")?.includes("taxonomy/12242/")),
		).toHaveAttribute(
			"href",
			"https://www.ncbi.nlm.nih.gov/datasets/taxonomy/12242/",
		);
	});

	it("renders isolates on the isolates tab", async () => {
		await renderRoute(`${base}/isolates`);

		expect(
			await screen.findByRole("link", {
				name: `${otu.isolates[0]?.name?.type} ${otu.isolates[0]?.name?.value}`,
			}),
		).toBeInTheDocument();
	});

	it("links an isolate to its detail view", async () => {
		await renderRoute(`${base}/isolates`);

		expect(
			await screen.findByRole("link", {
				name: `${otu.isolates[0]?.name?.type} ${otu.isolates[0]?.name?.value}`,
			}),
		).toHaveAttribute("href", `${base}/isolates/${otu.isolates[0]?.id}`);
	});

	it("renders an isolate detail view", async () => {
		const isolate = otu.isolates[0];
		await renderRoute(`${base}/isolates/${isolate?.id}`);

		expect(
			await screen.findByRole("heading", {
				name: `${isolate?.name?.type} ${isolate?.name?.value}`,
			}),
		).toBeInTheDocument();
		await screen.findByRole("button", {
			name: isolate?.sequences[0]?.definition,
		});
		await screen
			.getByRole("button", {
				name: isolate?.sequences[0]?.definition,
			})
			.click();
		expect(
			await screen.findByText(isolate?.sequences[0]?.sequence ?? ""),
		).toBeInTheDocument();
	});

	it("renders every change on the history tab", async () => {
		const firstChangeAt = new Date("2024-01-02T03:04:05Z");
		const secondChangeAt = new Date("2024-02-03T04:05:06Z");
		const changedOtu = createFakeLocalOtuV2({
			id: otu.id,
			referenceId: reference.id,
			version: 2,
			changes: [
				{
					version: 2,
					command: "CreateIsolate",
					commandSchemaVersion: 1,
					payload: { isolate: otu.isolates[0] },
					source: "user",
					user: otu.mostRecentChange.user,
					createdAt: firstChangeAt,
				},
				{ ...otu.mostRecentChange, createdAt: secondChangeAt },
			],
		});
		mockGetLocalOtuV2(changedOtu);
		await renderRoute(`${base}/history`);

		const history = await screen.findByRole("list", {
			name: "OTU change history",
		});
		const items = within(history).getAllByRole("listitem");

		expect(items).toHaveLength(2);
		expect(items[0]).toHaveTextContent(/created isolate/);
		expect(items[0]).toHaveTextContent("Version 2");
		expect(items[1]).toHaveTextContent(/created OTU/);
		expect(items[1]).toHaveTextContent("Version 1");

		const times = within(history).getAllByRole("button");
		await userEvent.hover(times[0]);
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"January 2, 2024 at 03:04:05",
		);
	});
});
