import Badge from "@base/Badge";
import Field, { FieldError, FieldLabel } from "@base/Field";
import TextArea from "@base/TextArea";
import { normalizeSequence, SEQUENCE_PATTERN } from "@virtool/contracts";
import { useFormContext, useWatch } from "react-hook-form";

/**
 * Displays the sequence field of a form.
 */
export default function SequenceField() {
	const {
		control,
		formState: { errors },
		register,
	} = useFormContext<{ sequence: string }>();
	const sequence = useWatch({ control, name: "sequence" });

	return (
		<Field className="flex flex-col">
			<FieldLabel>
				Sequence <Badge>{sequence?.length}</Badge>
			</FieldLabel>
			<TextArea
				className="font-mono uppercase"
				aria-required
				{...register("sequence", {
					required: "Required Field",
					setValueAs: normalizeSequence,
					pattern: {
						value: SEQUENCE_PATTERN,
						message: "Sequence should only contain the characters: ATCGNRYKM",
					},
				})}
			/>
			<FieldError errors={[errors.sequence]} />
		</Field>
	);
}
