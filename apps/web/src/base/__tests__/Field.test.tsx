import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { ChevronDown } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "../Checkbox";
import Field, {
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "../Field";
import Input from "../Input";
import Select, { SelectButton } from "../Select";
import Switch from "../Switch";

describe("<Field />", () => {
	it("should not mark the control invalid or described when there is no description or error", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Username</FieldLabel>
				<Input />
				<FieldError />
			</Field>,
		);

		const input = screen.getByRole("textbox");

		expect(input).not.toHaveAttribute("aria-invalid");
		expect(input).not.toHaveAttribute("aria-describedby");
	});

	it("should name the control with its label and describe it with its description", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Username</FieldLabel>
				<Input />
				<FieldDescription>Shown to other users</FieldDescription>
				<FieldError />
			</Field>,
		);

		expect(
			screen.getByRole("textbox", { name: "Username" }),
		).toHaveAccessibleDescription("Shown to other users");
	});

	it("should mark the control invalid and describe it with the error", () => {
		renderWithProviders(
			<Field>
				<FieldLabel>Username</FieldLabel>
				<Input />
				<FieldDescription>Shown to other users</FieldDescription>
				<FieldError>Username is required</FieldError>
			</Field>,
		);

		const input = screen.getByRole("textbox");

		expect(input).toBeInvalid();
		expect(input).toHaveAccessibleDescription(
			"Shown to other users Username is required",
		);
	});

	it("should let explicit props override the field", () => {
		renderWithProviders(
			<Field>
				<FieldLabel htmlFor="custom">Username</FieldLabel>
				<Input id="custom" aria-invalid={false} />
				<FieldError>Username is required</FieldError>
			</Field>,
		);

		const input = screen.getByRole("textbox", { name: "Username" });

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

describe('<FieldLabel variant="row" />', () => {
	function renderRow(onCheckedChange = vi.fn(), ariaLabel?: string) {
		renderWithProviders(
			<FieldLabel variant="row">
				<Field orientation="horizontal">
					<FieldContent>
						<FieldTitle>Prefer acronyms</FieldTitle>
						<FieldDescription>Name OTUs by their acronym.</FieldDescription>
					</FieldContent>
					<Switch aria-label={ariaLabel} onCheckedChange={onCheckedChange} />
				</Field>
			</FieldLabel>,
		);

		return onCheckedChange;
	}

	it("should name the control with the title and describe it with the description", () => {
		renderRow();

		const control = screen.getByRole("switch", { name: "Prefer acronyms" });

		expect(control).toHaveAccessibleDescription("Name OTUs by their acronym.");
	});

	it("should toggle the control when the description is clicked", async () => {
		const onCheckedChange = renderRow();

		await userEvent.click(screen.getByText("Name OTUs by their acronym."));

		expect(onCheckedChange).toHaveBeenCalledWith(true);
	});

	it("should let an explicit aria-label name the control", () => {
		renderRow(vi.fn(), "Use acronyms");

		expect(
			screen.getByRole("switch", { name: "Use acronyms" }),
		).toBeInTheDocument();
	});
});

describe("<FieldError />", () => {
	it("should announce its message as an assertive live region with a non-color icon", () => {
		renderWithProviders(<FieldError>Username is required</FieldError>);

		const alert = screen.getByRole("alert");

		expect(alert).toMatchTextContent("Username is required");
		expect(alert.querySelector("svg")).not.toBeNull();
	});

	it("should not show an icon when there is no error", () => {
		renderWithProviders(<FieldError />);

		expect(screen.getByRole("alert").querySelector("svg")).toBeNull();
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
