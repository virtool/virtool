import Button from "@base/Button";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { inputBaseClasses, inputHeightClass } from "@base/styles";
import { useUpdateLocalOtuIsolate } from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import {
	type LocalOtuV2IsolateDetail,
	OtuV2IsolateNameType,
	UpdateLocalOtuIsolateCommand,
} from "@virtool/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = { nameType: OtuV2IsolateNameType; nameValue: string };

/** Edit the name and name type of one isolate. */
export default function EditLocalOtuIsolate({
	referenceId,
	otuId,
	version,
	isolate,
}: {
	referenceId: string;
	otuId: string;
	version: number;
	isolate: LocalOtuV2IsolateDetail;
}) {
	const canModify = useCanModifyReferenceV2Otus(referenceId);
	const [open, setOpen] = useState(false);
	const [validationError, setValidationError] = useState<string>();
	const mutation = useUpdateLocalOtuIsolate(referenceId);
	const { register, handleSubmit, reset } = useForm<FormValues>({
		values: {
			nameType: isolate.name?.type ?? OtuV2IsolateNameType.isolate,
			nameValue: isolate.name?.value ?? "",
		},
	});

	function closeDialog(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			reset();
			setValidationError(undefined);
			mutation.reset();
		}
	}

	function onSubmit(values: FormValues) {
		setValidationError(undefined);
		const nameValue = values.nameValue.trim();
		const parsed = UpdateLocalOtuIsolateCommand.safeParse({
			type: "UpdateIsolate",
			schemaVersion: 1,
			otuId,
			expectedVersion: version,
			payload: {
				isolateId: isolate.id,
				name: nameValue ? { type: values.nameType, value: nameValue } : null,
			},
		});
		if (!parsed.success) {
			setValidationError(
				parsed.error.issues[0]?.message ?? "Invalid isolate name.",
			);
			return;
		}
		mutation.mutate(parsed.data, { onSuccess: () => closeDialog(false) });
	}

	return (
		<>
			{canModify && (
				<Button color="gray" onClick={() => setOpen(true)}>
					Edit isolate name
				</Button>
			)}
			<Dialog open={open} onOpenChange={closeDialog}>
				<DialogContent>
					<DialogTitle>Edit isolate name</DialogTitle>
					<form onSubmit={handleSubmit(onSubmit)}>
						<InputGroup>
							<InputLabel htmlFor="isolate-name-type">Name type</InputLabel>
							<select
								id="isolate-name-type"
								className={`${inputBaseClasses} ${inputHeightClass}`}
								{...register("nameType")}
							>
								{Object.values(OtuV2IsolateNameType).map((type) => (
									<option key={type} value={type}>
										{type}
									</option>
								))}
							</select>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor="isolate-name-value">Name</InputLabel>
							<InputSimple id="isolate-name-value" {...register("nameValue")} />
						</InputGroup>
						<p className="mb-3 text-sm text-slate-600">
							Leave the name blank to make this an unnamed isolate.
						</p>
						{validationError && <InputError>{validationError}</InputError>}
						{mutation.isError && (
							<InputError>{mutation.error.message}</InputError>
						)}
						<Button type="submit" color="blue" disabled={mutation.isPending}>
							Save isolate name
						</Button>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
