import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/setup";
import { ChevronDown } from "lucide-react";
import { describe, expect, it } from "vitest";
import Checkbox from "../Checkbox";
import Field, {
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "../Field";
import Input from "../Input";
import Select, { SelectButton } from "../Select";

describe("<Field />", () => {
	it("should connect the label to the control", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Handle</FieldLabel>
				<Input />
			</Field>,
		);

		expect(screen.getByRole("textbox", { name: "Handle" })).toBeInTheDocument();
	});

	it("should not mark the control invalid or described when there is no description or error", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Handle</FieldLabel>
				<Input />
				<FieldError />
			</Field>,
		);

		const input = screen.getByRole("textbox");

		expect(input).not.toHaveAttribute("aria-invalid");
		expect(input).not.toHaveAttribute("aria-describedby");
	});

	it("should describe the control with its description", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Handle</FieldLabel>
				<Input />
				<FieldDescription>Shown to other users</FieldDescription>
				<FieldError />
			</Field>,
		);

		expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
			"Shown to other users",
		);
	});

	it("should mark the control invalid and describe it with the error", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Handle</FieldLabel>
				<Input />
				<FieldDescription>Shown to other users</FieldDescription>
				<FieldError>Handle is required</FieldError>
			</Field>,
		);

		const input = screen.getByRole("textbox");

		expect(input).toBeInvalid();
		expect(input).toHaveAccessibleDescription(
			"Shown to other users Handle is required",
		);
	});

	it("should let explicit props override the field", () => {
		renderWithProviders(
			<Field>
				<FieldLabel htmlFor="custom">Handle</FieldLabel>
				<Input id="custom" aria-invalid={false} />
				<FieldError>Handle is required</FieldError>
			</Field>,
		);

		const input = screen.getByRole("textbox", { name: "Handle" });

		expect(input).toHaveAttribute("id", "custom");
		expect(input).not.toBeInvalid();
	});

	it("should connect a checkbox in a horizontal field", () => {
		renderWithProviders(
			<Field orientation="horizontal">
				<Checkbox />
				<FieldLabel>Remember me</FieldLabel>
			</Field>,
		);

		expect(
			screen.getByRole("checkbox", { name: "Remember me" }),
		).toBeInTheDocument();
	});

	it("should connect a select trigger", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Library type</FieldLabel>
				<Select>
					<SelectButton icon={ChevronDown} />
				</Select>
				<FieldError>Library type is required</FieldError>
			</Field>,
		);

		const trigger = screen.getByRole("combobox", { name: "Library type" });

		expect(trigger).toHaveAttribute("aria-invalid", "true");
		expect(trigger).toHaveAccessibleDescription("Library type is required");
	});
});

describe("<FieldError />", () => {
	it("should announce its message as an assertive live region", () => {
		renderWithProviders(<FieldError>Handle is required</FieldError>);

		expect(screen.getByRole("alert")).toHaveTextContent("Handle is required");
	});

	it("should show a non-color icon alongside the message", () => {
		renderWithProviders(<FieldError>Handle is required</FieldError>);

		expect(screen.getByRole("alert").querySelector("svg")).not.toBeNull();
	});

	it("should not show an icon when there is no error", () => {
		renderWithProviders(<FieldError />);

		expect(screen.getByRole("alert").querySelector("svg")).toBeNull();
	});

	it("should show one message for duplicate errors", () => {
		renderWithProviders(
			<FieldError
				errors={[{ message: "Required" }, undefined, { message: "Required" }]}
			/>,
		);

		expect(screen.getByRole("alert")).toHaveTextContent(/^Required$/);
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("should list several distinct errors", () => {
		renderWithProviders(
			<FieldError
				errors={[{ message: "Too short" }, { message: "Required" }]}
			/>,
		);

		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});
});

describe("<FieldSet />", () => {
	it("should name the group with its legend", () => {
		renderWithProviders(
			<FieldSet>
				<FieldLegend>Permissions</FieldLegend>
				<Field orientation="horizontal">
					<Checkbox />
					<FieldLabel>Create samples</FieldLabel>
				</Field>
			</FieldSet>,
		);

		expect(
			screen.getByRole("group", { name: "Permissions" }),
		).toBeInTheDocument();
	});
});
