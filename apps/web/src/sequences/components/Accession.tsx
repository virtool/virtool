import { getErrorStatus } from "@app/queryErrors";
import {
	InputContainer,
	InputError,
	InputGroup,
	InputIconButton,
	InputLabel,
	InputLoading,
	InputSimple,
} from "@base/Input";
import { useGetGenbank } from "@otus/queries";
import { WandSparkles } from "lucide-react";
import { useFormContext } from "react-hook-form";

type FormValues = {
	accession: string;
	definition: string;
	host: string;
	sequence: string;
};

/**
 * Displays the accession field of a form for a sequence
 */
export default function Accession() {
	const { error, isPending, mutate, reset } = useGetGenbank();

	const {
		formState: { errors },
		getValues,
		register,
		setValue,
	} = useFormContext<FormValues>();

	const notFound = getErrorStatus(error) === 404;

	function handleAutoFill() {
		mutate(getValues("accession"), {
			onSuccess: (genbank) => {
				setValue("accession", genbank.accession);
				setValue("definition", genbank.definition);
				setValue("host", genbank.host);
				setValue("sequence", genbank.sequence);
			},
		});
	}

	return (
		<InputGroup>
			<InputLabel htmlFor="accession">Accession (ID)</InputLabel>
			<InputContainer align="right">
				<InputSimple
					id="accession"
					aria-required
					aria-invalid={notFound || Boolean(errors.accession) || undefined}
					aria-describedby={
						notFound || errors.accession ? "accession-error" : undefined
					}
					{...register("accession", {
						required: "Required Field",
						onChange: () => {
							if (error) {
								reset();
							}
						},
					})}
				/>
				{isPending ? (
					<InputLoading />
				) : (
					<InputIconButton
						IconComponent={WandSparkles}
						tip="Auto Fill"
						onClick={handleAutoFill}
					/>
				)}
			</InputContainer>
			<InputError id="accession-error">
				{notFound ? "Accession not found" : errors.accession?.message}
			</InputError>
		</InputGroup>
	);
}
