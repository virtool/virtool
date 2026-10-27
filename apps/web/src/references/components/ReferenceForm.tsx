import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import TextArea from "@base/TextArea";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

export type ReferenceFormMode = "edit" | "empty";

type FormValues = {
	name: string;
	description: string;
	organism: string;
};

type ReferenceFormProps = {
	/** Form validation errors */
	errors: FieldErrors<FormValues>;
	/** The mode of the reference form */
	mode: ReferenceFormMode;
	/** Function to register form fields */
	register: UseFormRegister<FormValues>;
};

/**
 * Form input fields for organism, name and description
 */
export function ReferenceForm({ errors, mode, register }: ReferenceFormProps) {
	const organismComponent =
		mode === "empty" || mode === "edit" ? (
			<Field>
				<FieldLabel>Organism</FieldLabel>
				<Input {...register("organism")} />
			</Field>
		) : null;

	return (
		<>
			<Field className="pb-0">
				<FieldLabel>Name</FieldLabel>
				<Input
					aria-required
					{...register("name", { required: "Required Field" })}
				/>
				<FieldError errors={[errors.name]} />
			</Field>

			{organismComponent}

			<Field>
				<FieldLabel>Description</FieldLabel>
				<TextArea {...register("description")} />
			</Field>
		</>
	);
}
