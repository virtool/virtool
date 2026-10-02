import { DialogFooter } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useForm } from "react-hook-form";

type FormValues = {
	name: string;
	acronym: string;
};

type OtuFormProps = {
	acronym?: string;
	/** Error message to be displayed */
	error?: string;
	name?: string;
	/** A callback function to be called when the form is submitted */
	onSubmit: (values: FormValues) => void;
};

/**
 * A form component for creating an OTU
 */
export default function OtuForm({
	acronym,
	error,
	name,
	onSubmit,
}: OtuFormProps) {
	const {
		formState: { errors },
		register,
		handleSubmit,
	} = useForm<FormValues>({
		defaultValues: { name: name || "", acronym: acronym || "" },
	});

	return (
		<form onSubmit={handleSubmit((values) => onSubmit({ ...values }))}>
			<div className="grid gap-4" style={{ gridTemplateColumns: "9fr 4fr" }}>
				<Field>
					<FieldLabel>Name</FieldLabel>
					<Input
						aria-required
						{...register("name", { required: "Name required" })}
					/>
					<FieldError>{errors.name?.message || error}</FieldError>
				</Field>

				<Field>
					<FieldLabel>Acronym</FieldLabel>
					<Input {...register("acronym")} />
				</Field>
			</div>
			<DialogFooter>
				<SaveButton />
			</DialogFooter>
		</form>
	);
}
