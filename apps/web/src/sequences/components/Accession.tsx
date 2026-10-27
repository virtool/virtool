import { getErrorStatus } from "@app/queryErrors";
import Field, { FieldError, FieldLabel } from "@base/Field";
import InputGroup, {
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@base/InputGroup";
import Loader from "@base/Loader";
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
		<Field>
			<FieldLabel>Accession (ID)</FieldLabel>
			<InputGroup>
				<InputGroupInput
					aria-required
					{...register("accession", {
						required: "Required Field",
						onChange: () => {
							if (error) {
								reset();
							}
						},
					})}
				/>
				<InputGroupAddon align="inline-end">
					{isPending ? (
						<Loader className="size-4" />
					) : (
						<InputGroupButton
							IconComponent={WandSparkles}
							tip="Auto Fill"
							onClick={handleAutoFill}
						/>
					)}
				</InputGroupAddon>
			</InputGroup>
			<FieldError>
				{notFound ? "Accession not found" : errors.accession?.message}
			</FieldError>
		</Field>
	);
}
