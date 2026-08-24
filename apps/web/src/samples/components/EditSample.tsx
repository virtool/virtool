import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import TextArea from "@base/TextArea";
import type { Sample } from "@virtool/contracts";
import { pick } from "es-toolkit/object";
import { useForm } from "react-hook-form";
import { useUpdateSample } from "../queries";

type EditSampleProps = {
	open?: boolean;
	/** The sample data */
	sample: Sample;
	setOpen?: (open: boolean) => void;
};

/**
 * Displays a dialog for editing the sample
 */
export default function EditSample({
	open = false,
	sample,
	setOpen = () => {},
}: EditSampleProps) {
	const mutation = useUpdateSample(sample.id);

	const { register, handleSubmit } = useForm({
		defaultValues: {
			name: sample.name ?? "",
			isolate: sample.isolate ?? "",
			host: sample.host ?? "",
			locale: sample.locale ?? "",
			notes: sample.notes ?? "",
		},
	});

	return (
		<Dialog open={open} onOpenChange={() => setOpen(false)}>
			<DialogContent>
				<DialogTitle>Edit Sample</DialogTitle>
				<form
					onSubmit={handleSubmit((values) =>
						mutation.mutate(
							{
								update: pick(values, [
									"name",
									"isolate",
									"host",
									"locale",
									"notes",
								]),
							},
							{
								onSuccess: () => {
									setOpen(false);
								},
							},
						),
					)}
				>
					<InputGroup>
						<InputLabel htmlFor="name">Name</InputLabel>
						<InputSimple
							id="name"
							aria-required
							aria-invalid={mutation.isError || undefined}
							aria-describedby={mutation.isError ? "name-error" : undefined}
							{...register("name")}
						/>
						<InputError id="name-error">
							{mutation.isError && (mutation.error.message || "Required Field")}
						</InputError>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor="isolate">Isolate</InputLabel>
						<InputSimple id="isolate" {...register("isolate")} />
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor="host">Host</InputLabel>
						<InputSimple id="host" {...register("host")} />
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor="locale">Locale</InputLabel>
						<InputSimple id="locale" {...register("locale")} />
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor="notes">Notes</InputLabel>
						<TextArea id="notes" {...register("notes")} />
					</InputGroup>

					<SaveButton />
				</form>
			</DialogContent>
		</Dialog>
	);
}
