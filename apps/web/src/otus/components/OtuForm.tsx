import { DialogFooter } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useForm } from "react-hook-form";

type FormValues = {
	name: string;
	abbreviation: string;
};

type OtuFormProps = {
	abbreviation?: string;
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
	abbreviation,
	error,
	name,
	onSubmit,
}: OtuFormProps) {
	const {
		formState: { errors },
		register,
		handleSubmit,
	} = useForm<FormValues>({
		defaultValues: { name: name || "", abbreviation: abbreviation || "" },
	});

	return (
		<form onSubmit={handleSubmit((values) => onSubmit({ ...values }))}>
			<div className="grid gap-4" style={{ gridTemplateColumns: "9fr 4fr" }}>
				<InputGroup>
					<InputLabel htmlFor="name">Name</InputLabel>
					<InputSimple
						id="name"
						aria-required
						aria-invalid={Boolean(errors.name) || Boolean(error) || undefined}
						aria-describedby={errors.name || error ? "name-error" : undefined}
						{...register("name", { required: "Name required" })}
					/>
					<InputError id="name-error">
						{errors.name?.message || error}
					</InputError>
				</InputGroup>

				<InputGroup>
					<InputLabel htmlFor="abbreviation">Abbreviation</InputLabel>
					<InputSimple id="abbreviation" {...register("abbreviation")} />
				</InputGroup>
			</div>
			<DialogFooter>
				<SaveButton />
			</DialogFooter>
		</form>
	);
}
