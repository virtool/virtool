import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeLocalOtuV2 } from "@tests/fake/otusV2";
import { createFakeReferenceV2 } from "@tests/fake/referencesV2";
import {
	mockDeleteLocalOtuIsolateV2,
	mockDeleteLocalOtuV2,
	mockGetLocalOtusV2,
	mockGetLocalOtuV2,
} from "@tests/server-fn/otusV2";
import { mockGetReferenceV2 } from "@tests/server-fn/referencesV2";
import { renderRoute } from "@tests/setup";
import { OtuV2IsolateNameType } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

describe("<LocalOtuDetail />", () => {
	const account = createFakeAccount();
	const reference = createFakeReferenceV2({
		users: [
			{
				id: account.id,
				handle: account.handle,
				modifyOtu: true,
				modify: false,
				publishVersion: false,
			},
		],
	});
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
	const base = `/refs/alpha/${reference.id}/otus/${otu.id}`;
	const firstIsolate = otu.isolates[0];
	if (!firstIsolate) {
		throw new Error("Expected fake OTU to contain an isolate.");
	}
	const deletableOtu = createFakeLocalOtuV2({
		...otu,
		isolates: [firstIsolate, { ...firstIsolate, id: crypto.randomUUID() }],
	});

	function renderDetailRoute(path: string) {
		return renderRoute(path, { account });
	}

	beforeEach(() => {
		mockGetReferenceV2(reference);
		mockGetLocalOtuV2(otu);
	});

	it("renders the header and OTU tab", async () => {
		await renderDetailRoute(base);

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

	it("deletes the OTU and returns to its Reference OTU list", async () => {
		const deleteOtu = mockDeleteLocalOtuV2();
		mockGetLocalOtusV2([]);
		const { router } = await renderDetailRoute(base);

		await userEvent.click(
			await screen.findByRole("button", { name: "Delete" }),
		);
		const dialog = await screen.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Confirm" }),
		);

		expect(deleteOtu).toHaveBeenCalledWith({
			data: {
				referenceId: reference.id,
				command: {
					type: "DeleteOTU",
					schemaVersion: 1,
					otuId: otu.id,
					expectedVersion: otu.version,
					payload: {},
				},
			},
		});
		expect(router.state.location.pathname).toBe(
			`/refs/alpha/${reference.id}/otus`,
		);
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

		await renderDetailRoute(
			`/refs/alpha/${reference.id}/otus/${otuWithIsolates.id}`,
		);

		expect(await screen.findByText("Isolate preview-0")).toBeInTheDocument();
		expect(screen.getByText("Isolate preview-4")).toBeInTheDocument();
		expect(screen.queryByText("Isolate preview-5")).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "View 2 more isolates" }),
		).toBeInTheDocument();
	});

	it("links preview isolates to their detail views", async () => {
		await renderDetailRoute(base);

		const isolate = otu.isolates[0];
		expect(
			await screen.findByRole("link", {
				name: `Isolate ${isolate?.name?.value}`,
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

		await renderDetailRoute(
			`/refs/alpha/${reference.id}/otus/${otuWithLineage.id}`,
		);

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
		await renderDetailRoute(`${base}/isolates`);

		expect(
			await screen.findByRole("link", {
				name: `Isolate ${otu.isolates[0]?.name?.value}`,
			}),
		).toBeInTheDocument();
		expect(document.querySelector("time")).toHaveAttribute(
			"datetime",
			otu.createdAt.toISOString(),
		);
	});

	it("filters isolates by name", async () => {
		const existingIsolate = otu.isolates[0];
		if (!existingIsolate) {
			throw new Error("Expected fake OTU to contain an isolate.");
		}
		const matchingIsolate = {
			...existingIsolate,
			id: crypto.randomUUID(),
			name: {
				type: OtuV2IsolateNameType.isolate,
				value: "matching isolate",
			},
		};
		const otuWithIsolates = createFakeLocalOtuV2({
			referenceId: reference.id,
			isolates: [matchingIsolate, existingIsolate],
		});
		mockGetLocalOtuV2(otuWithIsolates);

		await renderDetailRoute(
			`/refs/alpha/${reference.id}/otus/${otuWithIsolates.id}/isolates`,
		);

		await userEvent.type(
			await screen.findByRole("textbox", { name: "Search isolates" }),
			"matching",
		);
		expect(
			await screen.findByRole("link", { name: "Isolate matching isolate" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", {
				name: `Isolate ${otu.isolates[0]?.name?.value}`,
			}),
		).not.toBeInTheDocument();
	});

	it("links an isolate to its detail view", async () => {
		await renderDetailRoute(`${base}/isolates`);

		expect(
			await screen.findByRole("link", {
				name: `Isolate ${otu.isolates[0]?.name?.value}`,
			}),
		).toHaveAttribute("href", `${base}/isolates/${otu.isolates[0]?.id}`);
	});

	it("shows isolate delete buttons in the list and detail views", async () => {
		mockGetLocalOtuV2(deletableOtu);
		const isolate = deletableOtu.isolates[0];
		await renderDetailRoute(`${base}/isolates`);

		expect(
			await screen.findAllByRole("button", { name: "Delete isolate" }),
		).toHaveLength(2);

		await renderDetailRoute(`${base}/isolates/${isolate?.id}`);
		expect(
			await screen.findByRole("button", { name: "Delete isolate" }),
		).toBeInTheDocument();
	});

	it("deletes an isolate and returns from its detail to the isolate list", async () => {
		mockGetLocalOtuV2(deletableOtu);
		const isolate = deletableOtu.isolates[0];
		if (!isolate) {
			throw new Error("Expected fake OTU to contain an isolate.");
		}
		const updatedOtu = {
			...deletableOtu,
			version: otu.version + 1,
			isolates: deletableOtu.isolates.slice(1),
		};
		const deleteIsolate = mockDeleteLocalOtuIsolateV2(updatedOtu);
		const { router } = await renderDetailRoute(
			`${base}/isolates/${isolate.id}`,
		);

		await userEvent.click(
			await screen.findByRole("button", { name: "Delete isolate" }),
		);
		const dialog = await screen.findByRole("alertdialog");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Confirm" }),
		);

		expect(deleteIsolate).toHaveBeenCalledWith({
			data: {
				referenceId: reference.id,
				command: {
					type: "DeleteIsolate",
					schemaVersion: 1,
					otuId: otu.id,
					expectedVersion: otu.version,
					payload: { isolateId: isolate.id },
				},
			},
		});
		expect(router.state.location.pathname).toBe(`${base}/isolates`);
	});

	it("hides isolate deletion for the final isolate in list and detail views", async () => {
		await renderDetailRoute(`${base}/isolates`);
		expect(
			screen.queryByRole("button", { name: "Delete isolate" }),
		).not.toBeInTheDocument();

		await renderDetailRoute(`${base}/isolates/${otu.isolates[0]?.id}`);
		expect(
			screen.queryByRole("button", { name: "Delete isolate" }),
		).not.toBeInTheDocument();
	});

	it.each(["read-only", "archived"])(
		"hides OTU and isolate mutation controls for %s references",
		async (restriction) => {
			mockGetReferenceV2(
				restriction === "archived"
					? { ...reference, archived: true }
					: { ...reference, users: [] },
			);
			mockGetLocalOtuV2(deletableOtu);

			await renderDetailRoute(base);
			expect(
				screen.queryByRole("button", { name: "Delete" }),
			).not.toBeInTheDocument();

			await renderDetailRoute(`${base}/isolates`);
			expect(
				screen.queryByRole("button", { name: "Create" }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Delete isolate" }),
			).not.toBeInTheDocument();

			await renderDetailRoute(
				`${base}/isolates/${deletableOtu.isolates[0]?.id}`,
			);
			expect(
				screen.queryByRole("button", { name: "Delete isolate" }),
			).not.toBeInTheDocument();
		},
	);

	it("renders an isolate detail view", async () => {
		const isolate = otu.isolates[0];
		await renderDetailRoute(`${base}/isolates/${isolate?.id}`);

		expect(
			await screen.findByRole("heading", {
				name: `Isolate ${isolate?.name?.value}`,
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
		const isolate = otu.isolates[0];
		if (!isolate) {
			throw new Error("Expected fake OTU to contain an isolate.");
		}
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
					name: isolate.name,
					source: "user",
					user: otu.mostRecentChange.user,
					createdAt: firstChangeAt,
				},
				{ ...otu.mostRecentChange, createdAt: secondChangeAt },
			],
		});
		mockGetLocalOtuV2(changedOtu);
		await renderDetailRoute(`${base}/history`);

		const history = await screen.findByRole("list", {
			name: "OTU change history",
		});
		const items = within(history).getAllByRole("listitem");

		expect(items).toHaveLength(2);
		expect(items[0]).toHaveTextContent(/created isolate/);
		expect(items[0]).toHaveTextContent(`Isolate ${isolate.name?.value}`);
		expect(items[0]).toHaveTextContent("Version 2");
		expect(items[1]).toHaveTextContent(/created OTU/);
		expect(items[1]).toHaveTextContent("Version 1");

		const times = within(history).getAllByRole("button");
		const latestTime = times[0];
		if (!latestTime) {
			throw new Error("Expected history to contain a timestamp.");
		}
		await userEvent.hover(latestTime);
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"January 2, 2024 at 03:04:05",
		);
	});
});
