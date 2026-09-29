import { formatIsolateName } from "@app/utils";
import { DialogFooter } from "@base/Dialog";
import Field, { FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useForm } from "react-hook-form";
import { SourceType } from "./SourceType";

type IsolateFormValues = {
	sourceName: string;
	sourceType: string;
};

type IsolateFormProps = {
	sourceName?: string;
	sourceType?: string;
	/** Indicates whether the source types are restricted */
	restrictSourceTypes: boolean;
	/** A callback function to be called when the form is submitted */
	onSubmit: (values: IsolateFormValues) => void;
	allowedSourceTypes: string[];
	/** Whether to show the read-only isolate name preview */
	showIsolateName?: boolean;
};

/**
 * Form for creating an OTU isolate
 */
export default function IsolateForm({
	sourceName,
	sourceType,
	restrictSourceTypes,
	onSubmit,
	allowedSourceTypes,
	showIsolateName = true,
}: IsolateFormProps) {
	const { control, register, handleSubmit, watch } = useForm({
		defaultValues: {
			sourceName: sourceName || "",
			sourceType: sourceType || (restrictSourceTypes ? "unknown" : ""),
		},
	});

	return (
		<form onSubmit={handleSubmit((values) => onSubmit({ ...values }))}>
			<div className="grid grid-cols-2 gap-4">
				<SourceType
					restrictSourceTypes={restrictSourceTypes}
					allowedSourceTypes={allowedSourceTypes}
					control={control}
				/>

				<Field>
					<FieldLabel>Source Name</FieldLabel>
					<Input
						{...register("sourceName")}
						disabled={watch("sourceType").toLowerCase() === "unknown"}
					/>
				</Field>
			</div>

			{showIsolateName && (
				<Field>
					<FieldLabel>Isolate Name</FieldLabel>
					<Input
						value={formatIsolateName({
							sourceName: watch("sourceName"),
							sourceType: watch("sourceType"),
						})}
						readOnly
					/>
				</Field>
			)}

			<DialogFooter>
				<SaveButton />
			</DialogFooter>
		</form>
	);
}
