import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemberItem, { type MemberItemProps } from "../MemberItem";

describe("<MemberItem />", () => {
	let props: MemberItemProps;

	beforeEach(() => {
		props = {
			canModify: false,
			handleOrName: "bob",
			id: 7,
			onEdit: vi.fn(),
			onRemove: vi.fn(),
		};
	});

	it("should render", () => {
		renderWithProviders(<MemberItem {...props} />);
		expect(screen.getByText("bob")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "edit member" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Remove member" }),
		).not.toBeInTheDocument();
	});

	it("should show modification button when [canModify=true]", () => {
		props.canModify = true;
		renderWithProviders(<MemberItem {...props} />);
		expect(
			screen.getByRole("button", { name: "edit member" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Remove member" }),
		).toBeInTheDocument();
	});

	it("should call onEdit when edit icon is clicked", async () => {
		props.canModify = true;
		renderWithProviders(<MemberItem {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "edit member" }));
		expect(props.onEdit).toHaveBeenCalledWith(props.id);
	});

	it("should call onRemove when trash icon is clicked", async () => {
		props.canModify = true;
		renderWithProviders(<MemberItem {...props} />);

		await userEvent.click(
			screen.getByRole("button", { name: "Remove member" }),
		);
		expect(props.onRemove).toHaveBeenCalledWith(props.id);
	});
});
