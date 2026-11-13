import { screen } from "@testing-library/react";
import { createFakeUser } from "@tests/fake/user";
import { mockSearchUsers } from "@tests/server-fn/users";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";
import AddReferenceUser from "../AddReferenceUser";

describe("<AddReferenceUser />", () => {
	it("omits users already members of the reference", async () => {
		const alice = createFakeUser({ handle: "alice" });
		const bob = createFakeUser({ handle: "bob" });
		mockSearchUsers([alice, bob]);

		renderWithProviders(
			<AddReferenceUser
				users={[
					{
						id: alice.id,
						handle: alice.handle,
						build: false,
						modify: false,
						modifyOtu: false,
						createdAt: new Date(),
					},
				]}
				onHide={() => undefined}
				refId={1}
				show
			/>,
		);

		expect(await screen.findByText("bob")).toBeInTheDocument();
		expect(screen.queryByText("alice")).not.toBeInTheDocument();
	});
});
