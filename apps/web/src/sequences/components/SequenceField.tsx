import Badge from "@base/Badge";
import { InputError, InputGroup, InputLabel } from "@base/Input";
import TextArea from "@base/TextArea";
import { useFormContext } from "react-hook-form";

/**
 * Displays the sequence field of a form.
 */
export default function SequenceField() {
	const {
		formState: { errors },
		register,
		watch,
	} = useFormContext<{ sequence: string }>();

	return (
		<InputGroup className="flex flex-col">
			<InputLabel htmlFor="sequence">
				Sequence <Badge>{watch("sequence")?.length}</Badge>
			</InputLabel>
			<TextArea
				className="font-mono uppercase"
				id="sequence"
				aria-required
				aria-invalid={Boolean(errors.sequence) || undefined}
				aria-describedby={errors.sequence ? "sequence-error" : undefined}
				{...register("sequence", {
					required: "Required Field",
					pattern: {
						value: /^[ATCGNRYKM]*$/,
						message: "Sequence should only contain the characters: ATCGNRYKM",
					},
				})}
			/>
			<InputError id="sequence-error">{errors.sequence?.message}</InputError>
		</InputGroup>
	);
}
