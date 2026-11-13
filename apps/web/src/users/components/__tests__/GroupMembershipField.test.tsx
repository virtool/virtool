import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import type { GroupMinimal } from "@virtool/contracts";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import GroupMembershipField from "../GroupMembershipField";

const foo: GroupMinimal = { id: 1, legacyId: null, name: "foo" };
const bar: GroupMinimal = { id: 2, legacyId: null, name: "bar" };
const baz: GroupMinimal = { id: 3, legacyId: null, name: "baz" };

type FieldProps = ComponentProps<typeof GroupMembershipField>;

function getProps(props: Partial<FieldProps> = {}): FieldProps {
	return {
		groups: [foo, bar, baz],
		memberGroups: [],
		primaryGroupId: null,
		onAdd: vi.fn(),
		onRemove: vi.fn(),
		onPrimaryGroupChange: vi.fn(),
		...props,
	};
}

function renderField(props: Partial<FieldProps> = {}) {
	const fieldProps = getProps(props);
	const result = renderWithProviders(<GroupMembershipField {...fieldProps} />);
	return { ...result, props: fieldProps };
}

describe("<GroupMembershipField />", () => {
	it("lists members by name with primary toggles and remove buttons", async () => {
		const { props } = renderField({
			memberGroups: [foo, bar],
			primaryGroupId: foo.id,
		});

		const toggles = screen.getAllByRole("button", { name: /^Primary group/ });
		expect(toggles.map((toggle) => toggle.getAttribute("aria-label"))).toEqual([
			"Primary group: bar",
			"Primary group: foo",
		]);
		const [barToggle, fooToggle] = toggles as [HTMLElement, HTMLElement];
		expect(barToggle).toHaveAttribute("aria-pressed", "false");
		expect(fooToggle).toHaveAttribute("aria-pressed", "true");

		await userEvent.click(barToggle);
		expect(props.onPrimaryGroupChange).toHaveBeenLastCalledWith(bar.id);

		await userEvent.click(fooToggle);
		expect(props.onPrimaryGroupChange).toHaveBeenLastCalledWith(null);

		await userEvent.click(screen.getByRole("button", { name: "Remove foo" }));
		expect(props.onRemove).toHaveBeenCalledWith(foo.id);
	});

	it("presses no primary toggle when there is no primary group", () => {
		renderField({ memberGroups: [foo, bar] });

		for (const name of ["Primary group: foo", "Primary group: bar"]) {
			expect(screen.getByRole("button", { name })).toHaveAttribute(
				"aria-pressed",
				"false",
			);
		}
	});

	it("adds a group using only the keyboard and offers only non-members", async () => {
		const { props } = renderField({ memberGroups: [foo] });

		const combobox = screen.getByRole("combobox", { name: "Add group" });
		await userEvent.tab();
		expect(combobox).toHaveFocus();

		await userEvent.keyboard("{ArrowDown}");
		expect(
			screen.queryByRole("option", { name: "foo" }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("option", { name: "baz" })).toBeInTheDocument();

		await userEvent.keyboard("{Enter}");
		expect(props.onAdd).toHaveBeenCalledWith(bar.id);
	});

	it("clears the search term after a group is added", async () => {
		const { props, rerender } = renderField({ memberGroups: [foo] });

		const combobox = screen.getByRole("combobox", { name: "Add group" });
		await userEvent.type(combobox, "bar");
		await userEvent.click(await screen.findByRole("option", { name: "bar" }));
		expect(props.onAdd).toHaveBeenCalledWith(bar.id);

		// A term left filtering to `bar` would empty the options once `bar` is a
		// member.
		rerender(<GroupMembershipField {...props} memberGroups={[foo, bar]} />);

		expect(combobox).toHaveValue("");
		await userEvent.click(
			screen.getByRole("button", { name: "Toggle Add group menu" }),
		);
		expect(screen.getByRole("option", { name: "baz" })).toBeInTheDocument();
	});

	it("says when the user is in no group or in every group", () => {
		const { props, rerender } = renderField();

		expect(
			screen.getByText("This user is not a member of any groups."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "Add group" }),
		).toBeInTheDocument();

		rerender(
			<GroupMembershipField {...props} memberGroups={[foo, bar, baz]} />,
		);

		expect(
			screen.getByText("This user is a member of every group."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("combobox", { name: "Add group" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("This user is not a member of any groups."),
		).not.toBeInTheDocument();
	});

	it("shows the placeholder instead of the combobox", () => {
		renderField({
			addPlaceholder: <p>Loading groups</p>,
			memberGroups: [foo],
		});

		expect(screen.getByText("Loading groups")).toBeInTheDocument();
		expect(
			screen.queryByRole("combobox", { name: "Add group" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Remove foo" }),
		).toBeInTheDocument();
	});
});
