import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeIndexMinimal } from "@tests/fake/indexes";
import { createFakeReference } from "@tests/fake/references";
import { mockFindIndexes } from "@tests/server-fn/indexes";
import { mockGetReference } from "@tests/server-fn/references";
import { renderRoute } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("<Indexes />", () => {
	const account = createFakeAccount({ administratorRole: "full" });
	let reference: ReturnType<typeof createFakeReference>;

	beforeEach(() => {
		reference = createFakeReference({ archived: false });
		mockGetReference(reference);
	});

	function path() {
		return `/refs/${reference.id}/indexes`;
	}

	it("lists a reference's builds", async () => {
		const index = createFakeIndexMinimal({
			version: 3,
			changeCount: 4,
			modifiedOtuCount: 2,
			ready: true,
		});
		mockFindIndexes([index]);

		await renderRoute(path(), { account });

		expect(await screen.findByText("Version 3")).toBeInTheDocument();
		expect(screen.getByText("4 changes made in 2 OTUs")).toBeInTheDocument();

		// `createdAt` is a `Date` now that indexes are served from here rather than
		// the snake_case Python API, so the attribution has to render one.
		const attribution = screen.getByText(index.user.handle, { exact: false });
		expect(attribution).toHaveTextContent(/ago$/);
	});

	it("offers a rebuild when the reference has unbuilt changes", async () => {
		mockFindIndexes([createFakeIndexMinimal({ ready: true })], {
			changeCount: 2,
		});

		await renderRoute(path(), { account });

		expect(
			await screen.findByRole("button", { name: "Create" }),
		).toBeInTheDocument();
	});

	it("does not offer a rebuild when nothing has changed", async () => {
		mockFindIndexes([createFakeIndexMinimal({ ready: true })], {
			changeCount: 0,
		});

		await renderRoute(path(), { account });

		expect(await screen.findByText(/version/i)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
	});

	it("explains an empty list that has unbuilt changes", async () => {
		mockFindIndexes([], { changeCount: 3 });

		await renderRoute(path(), { account });

		expect(await screen.findByText("No indexes found")).toBeInTheDocument();
		expect(
			screen.getByText("This reference has unbuilt changes."),
		).toBeInTheDocument();
	});

	it("explains an empty list with nothing to build", async () => {
		mockFindIndexes([], { changeCount: 0 });

		await renderRoute(path(), { account });

		expect(await screen.findByText("No indexes found")).toBeInTheDocument();
		expect(
			screen.getByText("This reference has no indexes yet."),
		).toBeInTheDocument();
	});
});
