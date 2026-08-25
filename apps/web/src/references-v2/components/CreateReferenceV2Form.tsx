import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import TextArea from "@base/TextArea";
import { useCreateReferenceV2 } from "@references-v2/queries";
import { useId } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
	name: string;
	description: string;
	defaultSegmentLengthTolerance: number;
};

/** A minimal form for creating a local v2 Reference. */
export default function CreateReferenceV2Form({
	onSuccess,
}: {
	onSuccess?: () => void;
}) {
	const mutation = useCreateReferenceV2();

	const nameId = useId();
	const descriptionId = useId();
	const toleranceId = useId();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({
		defaultValues: {
			name: "",
			description: "",
			defaultSegmentLengthTolerance: 0.05,
		},
	});

	function onSubmit(values: FormValues) {
		mutation.mutate(
			{
				name: values.name,
				description: values.description,
				defaultSegmentLengthTolerance: values.defaultSegmentLengthTolerance,
			},
			{
				onSuccess,
			},
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<InputGroup>
				<InputLabel htmlFor={nameId}>Name</InputLabel>
				<InputSimple
					id={nameId}
					aria-required
					aria-invalid={Boolean(errors.name) || undefined}
					aria-describedby={errors.name ? `${nameId}-error` : undefined}
					{...register("name", { required: "Required Field" })}
				/>
				<InputError id={`${nameId}-error`}>{errors.name?.message}</InputError>
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={descriptionId}>Description</InputLabel>
				<TextArea id={descriptionId} {...register("description")} />
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={toleranceId}>
					Default segment length tolerance
				</InputLabel>
				<InputSimple
					id={toleranceId}
					type="number"
					step="0.01"
					min={0}
					max={1}
					{...register("defaultSegmentLengthTolerance", {
						valueAsNumber: true,
					})}
				/>
			</InputGroup>

			{mutation.isError && <InputError>{mutation.error.message}</InputError>}

			<Button color="blue" type="submit" disabled={mutation.isPending}>
				Create
			</Button>
		</form>
	);
}
