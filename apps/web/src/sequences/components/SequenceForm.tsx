import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import type { OtuSegment, OtuSequence } from "@virtool/contracts";
import { FormProvider, useForm } from "react-hook-form";
import Accession from "./Accession";
import SequenceField from "./SequenceField";
import SequenceSegmentField from "./SequenceSegmentField";

type SequenceFormValues = {
	accession: string;
	definition: string;
	host: string;
	segment: string | null;
	sequence: string;
};

type SequenceFormProps = {
	/** The sequence. This is undefined when creating a new sequence. */
	activeSequence?: OtuSequence;

	hasSchema: boolean;

	/** A callback function to add/edit a genome sequence  */
	onSubmit: (formValues: SequenceFormValues) => void;

	/** The ID of the sequence's parent OTU. */
	otuId: string;

	/** The ID of the sequence's parent reference. */
	refId: string;

	/** A list of unreferenced segments */
	segments: OtuSegment[];
};

/**
 * A form for creating or editing a genome sequence
 */
export default function SequenceForm({
	activeSequence,
	hasSchema,
	onSubmit,
	otuId,
	refId,
	segments,
}: SequenceFormProps) {
	const {
		accession,
		definition,
		host,
		segment = null,
		sequence = "",
	} = activeSequence || {};

	const methods = useForm<SequenceFormValues>({
		defaultValues: {
			segment: segment || null,
			accession: accession || "",
			definition: definition || "",
			host: host || "",
			sequence: sequence || "",
		},
	});

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = methods;

	return (
		<FormProvider {...methods}>
			<form onSubmit={handleSubmit(onSubmit)}>
				<SequenceSegmentField
					hasSchema={hasSchema}
					otuId={otuId}
					refId={refId}
					segments={segments}
				/>

				<Accession />

				<Field>
					<FieldLabel>Host</FieldLabel>
					<Input {...register("host")} />
				</Field>

				<Field>
					<FieldLabel>Definition</FieldLabel>
					<Input
						aria-required
						{...register("definition", {
							required: "Required Field",
						})}
					/>
					<FieldError errors={[errors.definition]} />
				</Field>

				<SequenceField />
				<SaveButton />
			</form>
		</FormProvider>
	);
}
