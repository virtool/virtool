import { screen } from "@testing-library/react";
import { createFakeIndex, createFakeIndexFile } from "@tests/fake/indexes";
import { createFakeReference } from "@tests/fake/references";
import { indexServerFnMocks, mockGetIndex } from "@tests/server-fn/indexes";
import { mockGetReference } from "@tests/server-fn/references";
import { renderRoute } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<IndexDetail />", () => {
	let reference: ReturnType<typeof createFakeReference>;

	beforeEach(() => {
		reference = createFakeReference();
		mockGetReference(reference);
	});

	it("renders the build's contributors, files, and OTUs", async () => {
		const index = createFakeIndex({
			version: 2,
			contributors: [{ id: 1, handle: "alice", count: 3 }],
			files: [
				createFakeIndexFile({
					downloadUrl: "/indexes/7/files/reference.fa.gz",
					name: "reference.fa.gz",
					size: 1024,
				}),
			],
			otus: [{ id: "abc", name: "Tobacco mosaic virus", changeCount: 3 }],
		});
		mockGetIndex(index);

		await renderRoute(`/refs/${reference.id}/indexes/${index.id}`);

		expect(await screen.findByText("Index 2")).toBeInTheDocument();
		expect(screen.getByText("alice")).toBeInTheDocument();
		expect(screen.getByText("Tobacco mosaic virus")).toBeInTheDocument();

		// Index files are still served by the Python API, so the download URL keeps
		// the `/api` prefix.
		expect(screen.getByText("reference.fa.gz").closest("a")).toHaveAttribute(
			"href",
			"/api/indexes/7/files/reference.fa.gz",
		);
	});

	it("renders not found when the index is gone", async () => {
		indexServerFnMocks.getIndexFn.mockRejectedValue(
			Object.assign(new Error("Index not found."), { status: 404 }),
		);

		await renderRoute(`/refs/${reference.id}/indexes/404`);

		expect(await screen.findByText("Not found")).toBeInTheDocument();
	});
});
