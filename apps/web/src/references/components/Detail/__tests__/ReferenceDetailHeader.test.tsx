import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeReference } from "@tests/fake/references";
import { mockGetReference } from "@tests/server-fn/references";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import ReferenceDetailHeader from "../ReferenceDetailHeader";

async function renderHeader({
	archived,
	canModify,
}: {
	archived: boolean;
	canModify: boolean;
}) {
	const reference = createFakeReference({ archived });
	mockGetReference(reference);
	mockGetAccount(
		createFakeAccount({ administratorRole: canModify ? "full" : null }),
	);

	await renderWithRouter(
		<ReferenceDetailHeader
			createdAt={reference.createdAt}
			detail={reference}
			name={reference.name}
			username={reference.user?.username ?? ""}
		/>,
		`/refs/${reference.id}/manage`,
	);

	return reference;
}

describe("<ReferenceDetailHeader />", () => {
	it("offers modify and archive on an active reference", async () => {
		const reference = await renderHeader({ archived: false, canModify: true });

		expect(screen.getByText(reference.name)).toBeInTheDocument();
		expect(
			screen.getByText(`${reference.user?.username} created`),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("button", { name: "modify" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "archive" })).toBeInTheDocument();
		expect(screen.queryByText("Archived")).toBeNull();
	});

	it("offers only unarchive on an archived reference", async () => {
		const reference = await renderHeader({ archived: true, canModify: true });

		expect(screen.getByText(reference.name)).toBeInTheDocument();
		expect(
			screen.getByText(`${reference.user?.username} created`),
		).toBeInTheDocument();
		expect(screen.getByText("Archived")).toBeInTheDocument();
		expect(
			await screen.findByRole("button", { name: "unarchive" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "modify" })).toBeNull();
	});

	it("renders no actions when the user cannot modify", async () => {
		await renderHeader({ archived: false, canModify: false });

		// The creation time is the only button: it opens its own tooltip.
		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(1);
		expect(buttons[0]?.querySelector("time")).not.toBeNull();
	});
});
