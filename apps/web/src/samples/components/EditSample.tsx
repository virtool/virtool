import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
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
					<Field>
						<FieldLabel>Name</FieldLabel>
						<Input aria-required {...register("name")} />
						<FieldError>
							{mutation.isError && (mutation.error.message || "Required Field")}
						</FieldError>
					</Field>
					<Field>
						<FieldLabel>Isolate</FieldLabel>
						<Input {...register("isolate")} />
					</Field>
					<Field>
						<FieldLabel>Host</FieldLabel>
						<Input {...register("host")} />
					</Field>
					<Field>
						<FieldLabel>Locale</FieldLabel>
						<Input {...register("locale")} />
					</Field>
					<Field>
						<FieldLabel>Notes</FieldLabel>
						<TextArea {...register("notes")} />
					</Field>

					<SaveButton />
				</form>
			</DialogContent>
		</Dialog>
	);
}
