import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeGroupMinimal } from "@tests/fake/groups";
import { renderWithProviders } from "@tests/setup";
import type { GroupMinimal } from "@virtool/contracts";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SampleUserGroup from "../SampleUserGroup";

describe("SampleUserGroup", () => {
	let group: GroupMinimal;
	let props: ComponentProps<typeof SampleUserGroup>;

	beforeEach(() => {
		group = createFakeGroupMinimal({ name: "bar" });
		props = {
			groups: [group],
			onChange: vi.fn(),
			selected: "",
		};
	});

	it("should render", () => {
		renderWithProviders(<SampleUserGroup {...props} />);

		expect(screen.getByLabelText("User Group")).toBeInTheDocument();
		expect(screen.getByRole("combobox")).toHaveTextContent("None");
	});

	it("should show the group options when opened", async () => {
		renderWithProviders(<SampleUserGroup {...props} />);

		await userEvent.click(screen.getByLabelText("User Group"));

		expect(screen.getByRole("option", { name: "None" })).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "bar" })).toBeInTheDocument();
	});

	it("should call onChange when a group is selected", async () => {
		renderWithProviders(<SampleUserGroup {...props} />);

		await userEvent.click(screen.getByLabelText("User Group"));
		await userEvent.click(screen.getByRole("option", { name: "bar" }));

		expect(props.onChange).toHaveBeenCalledWith(String(group.id));
	});

	it("should call onChange with an empty value when None is selected", async () => {
		renderWithProviders(
			<SampleUserGroup {...props} selected={String(group.id)} />,
		);

		await userEvent.click(screen.getByLabelText("User Group"));
		await userEvent.click(screen.getByRole("option", { name: "None" }));

		expect(props.onChange).toHaveBeenCalledWith("");
	});
});
