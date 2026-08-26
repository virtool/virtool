import Button from "@base/Button";
import { InputError, InputGroup, InputLabel } from "@base/Input";
import TextArea from "@base/TextArea";
import { useCreateLocalOtuFromAccessions } from "@otus-v2/queries";
import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
	accessions: string;
};

function parseAccessions(value: string): string[] {
	return Array.from(new Set(value.split(/[\s,]+/).filter(Boolean)));
}

/**
 * A form that creates one complete local OTU from NCBI accessions.
 *
 * Each accession becomes a segment of a single isolate, so a multipartite
 * genome is entered by listing every segment's accession. The server resolves
 * the records; the mutation mints the UUIDs and writes the whole aggregate.
 */
export default function CreateLocalOtuFromAccessionForm({
	referenceId,
	defaultSegmentLengthTolerance,
}: {
	referenceId: string;
	defaultSegmentLengthTolerance: number;
}) {
	const navigate = useNavigate();
	const mutation = useCreateLocalOtuFromAccessions(
		referenceId,
		defaultSegmentLengthTolerance,
	);

	const accessionsId = useId();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ defaultValues: { accessions: "" } });

	function onSubmit(values: FormValues) {
		const accessions = parseAccessions(values.accessions);

		mutation.mutate(accessions, {
			onSuccess: (otu) => {
				navigate({
					to: "/refs/beta/$referenceId/otus/$otuId",
					params: { referenceId, otuId: otu.id },
				});
			},
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<InputGroup>
				<InputLabel htmlFor={accessionsId}>Accessions</InputLabel>
				<TextArea
					id={accessionsId}
					placeholder="NC_004452.3"
					aria-required
					aria-invalid={Boolean(errors.accessions) || undefined}
					{...register("accessions", {
						required: "Required Field",
						validate: (value) =>
							parseAccessions(value).length > 0 ||
							"Enter at least one accession.",
					})}
				/>
				<InputError>{errors.accessions?.message}</InputError>
			</InputGroup>

			<p>
				List one accession per virus, or every segment's accession for a
				multipartite genome. Separate them with spaces, commas, or new lines.
			</p>

			{mutation.isError && <InputError>{mutation.error.message}</InputError>}

			<Button color="blue" type="submit" disabled={mutation.isPending}>
				Create
			</Button>
		</form>
	);
}
