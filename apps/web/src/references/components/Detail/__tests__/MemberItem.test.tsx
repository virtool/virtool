import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import MemberItem from "../MemberItem";

describe("<MemberItem />", () => {
	it("shows the member without controls when [canModify=false]", () => {
		renderWithProviders(
			<MemberItem
				canModify={false}
				name="bob"
				id={7}
				onEdit={vi.fn()}
				onRemove={vi.fn()}
			/>,
		);

		expect(screen.getByText("bob")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "edit member" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Remove member" })).toBeNull();
	});

	it("shows an invited member without a username", () => {
		renderWithProviders(
			<MemberItem
				canModify={false}
				name={null}
				id={7}
				onEdit={vi.fn()}
				onRemove={vi.fn()}
			/>,
		);

		expect(screen.getByText("No username yet")).toBeInTheDocument();
	});

	it("edits and removes the member when [canModify=true]", async () => {
		const onEdit = vi.fn();
		const onRemove = vi.fn();

		renderWithProviders(
			<MemberItem
				canModify
				name="bob"
				id={7}
				onEdit={onEdit}
				onRemove={onRemove}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "edit member" }));
		await userEvent.click(
			screen.getByRole("button", { name: "Remove member" }),
		);

		expect(onEdit).toHaveBeenCalledWith(7);
		expect(onRemove).toHaveBeenCalledWith(7);
	});
});
