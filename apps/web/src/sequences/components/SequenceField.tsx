import Badge from "@base/Badge";
import { InputError, InputGroup, InputLabel } from "@base/Input";
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
		<InputGroup className="flex flex-col">
			<InputLabel htmlFor="sequence">
				Sequence <Badge>{sequence?.length}</Badge>
			</InputLabel>
			<TextArea
				className="font-mono uppercase"
				id="sequence"
				aria-required
				aria-invalid={Boolean(errors.sequence) || undefined}
				aria-describedby={errors.sequence ? "sequence-error" : undefined}
				{...register("sequence", {
					required: "Required Field",
					setValueAs: normalizeSequence,
					pattern: {
						value: SEQUENCE_PATTERN,
						message: "Sequence should only contain the characters: ATCGNRYKM",
					},
				})}
			/>
			<InputError id="sequence-error">{errors.sequence?.message}</InputError>
		</InputGroup>
	);
}
