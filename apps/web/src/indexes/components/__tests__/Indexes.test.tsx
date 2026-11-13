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

		// `createdAt` crosses the wire as a `Date`, so the attribution renders it
		// as a relative time.
		const attribution = screen.getByText(index.user.username, { exact: false });
		expect(attribution).toMatchTextContent(/ago$/);
	});

	it.each([
		{ changeCount: 2, offered: true },
		{ changeCount: 0, offered: false },
	])(
		"offers a rebuild only when there are unbuilt changes ($changeCount)",
		async ({ changeCount, offered }) => {
			mockFindIndexes([createFakeIndexMinimal({ ready: true })], {
				changeCount,
			});

			await renderRoute(path(), { account });

			expect(await screen.findByText(/version/i)).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "Create" }) !== null).toBe(
				offered,
			);
		},
	);

	it.each([
		{ changeCount: 3, description: "This reference has unbuilt changes." },
		{ changeCount: 0, description: "This reference has no indexes yet." },
	])(
		"explains an empty list ($changeCount changes)",
		async ({ changeCount, description }) => {
			mockFindIndexes([], { changeCount });

			await renderRoute(path(), { account });

			expect(await screen.findByText("No indexes found")).toBeInTheDocument();
			expect(screen.getByText(description)).toBeInTheDocument();
		},
	);
});
