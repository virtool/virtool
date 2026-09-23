import Box from "@base/Box";
import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SectionHeader from "@base/SectionHeader";
import TextArea from "@base/TextArea";
import { useCheckReferenceV2Right } from "@references-v2/hooks";
import { useUpdateReferenceV2 } from "@references-v2/queries";
import type { ReferenceV2 } from "@virtool/contracts";
import { useId } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
	name: string;
	description: string;
	defaultSegmentLengthTolerance: number;
};

/** Edit the metadata of an active local Reference. */
export default function EditReferenceV2({
	reference,
}: {
	reference: ReferenceV2;
}) {
	const canModify =
		useCheckReferenceV2Right(reference.id, "modify") &&
		!reference.archived &&
		reference.kind === "local";
	const mutation = useUpdateReferenceV2(reference.id);
	const nameId = useId();
	const descriptionId = useId();
	const toleranceId = useId();
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<FormValues>({
		values: {
			name: reference.name,
			description: reference.description,
			defaultSegmentLengthTolerance: reference.defaultSegmentLengthTolerance,
		},
	});

	function onSubmit(values: FormValues) {
		mutation.mutate({ ...values, expectedVersion: reference.version });
	}

	return (
		<section aria-labelledby="reference-details-heading">
			<SectionHeader>
				<h2 id="reference-details-heading">Reference details</h2>
			</SectionHeader>
			<Box>
				<form onSubmit={handleSubmit(onSubmit)}>
					<InputGroup>
						<InputLabel htmlFor={nameId}>Name</InputLabel>
						<InputSimple
							id={nameId}
							disabled={!canModify || mutation.isPending}
							aria-required
							aria-invalid={Boolean(errors.name) || undefined}
							{...register("name", { required: "Required Field" })}
						/>
						<InputError>{errors.name?.message}</InputError>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor={descriptionId}>Description</InputLabel>
						<TextArea
							id={descriptionId}
							disabled={!canModify || mutation.isPending}
							{...register("description")}
						/>
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
							disabled={!canModify || mutation.isPending}
							{...register("defaultSegmentLengthTolerance", {
								valueAsNumber: true,
							})}
						/>
					</InputGroup>
					{mutation.isError && (
						<InputError>{mutation.error.message}</InputError>
					)}
					{canModify && (
						<Button color="blue" type="submit" disabled={mutation.isPending}>
							Save
						</Button>
					)}
				</form>
			</Box>
		</section>
	);
}
