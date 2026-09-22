import { cn } from "@app/cn";
import Button from "@base/Button";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { inputBaseClasses, inputHeightClass } from "@base/styles";
import { formatV2IsolateName } from "@otus-v2/isolateName";
import {
	usePreviewLocalOtuPlan,
	useUpdateLocalOtuPlan,
} from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import {
	type LocalOtuV2Overview,
	type LocalOtuV2PlanPreview,
	OtuV2MoleculeType,
	OtuV2SegmentRule,
	OtuV2Strandedness,
	OtuV2Topology,
	UpdateLocalOtuPlanCommand,
	type UpdateLocalOtuPlanCommandInput,
} from "@virtool/contracts";
import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

type SegmentValues = {
	id: string;
	namePrefix: string;
	nameKey: string;
	length: number;
	lengthTolerance: number;
	rule: string;
};
type FormValues = {
	moleculeType: string;
	strandedness: string;
	topology: string;
	segments: SegmentValues[];
};
const selectClasses = cn(inputBaseClasses, inputHeightClass);

function initialValues(otu: LocalOtuV2Overview): FormValues {
	return {
		moleculeType: otu.molecule.type,
		strandedness: otu.molecule.strandedness,
		topology: otu.molecule.topology,
		segments: otu.plan.segments.map((segment) => ({
			id: segment.id,
			namePrefix: segment.name?.prefix ?? "",
			nameKey: segment.name?.key ?? "",
			length: segment.length,
			lengthTolerance: segment.lengthTolerance,
			rule: segment.rule,
		})),
	};
}

/** Preview all surviving isolates before changing a local OTU's molecule or plan. */
export default function EditLocalOtuPlan({
	referenceId,
	otu,
}: {
	referenceId: string;
	otu: LocalOtuV2Overview;
}) {
	const canModify = useCanModifyReferenceV2Otus(referenceId);
	const [open, setOpen] = useState(false);
	const [preview, setPreview] = useState<{
		command: UpdateLocalOtuPlanCommandInput;
		result: LocalOtuV2PlanPreview;
	}>();
	const [validationError, setValidationError] = useState<string>();
	const revision = useRef(0);
	const previewMutation = usePreviewLocalOtuPlan(referenceId);
	const saveMutation = useUpdateLocalOtuPlan(referenceId);
	const {
		register,
		handleSubmit,
		control,
		reset,
		formState: { errors },
	} = useForm<FormValues>({ values: initialValues(otu) });
	const { fields, append, remove } = useFieldArray({
		control,
		name: "segments",
		keyName: "fieldKey",
	});

	function invalidatePreview() {
		revision.current += 1;
		setPreview(undefined);
		setValidationError(undefined);
		previewMutation.reset();
		saveMutation.reset();
	}

	function closeDialog(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			invalidatePreview();
			reset(initialValues(otu));
		}
	}

	async function onPreview(values: FormValues) {
		invalidatePreview();
		const command: UpdateLocalOtuPlanCommandInput = {
			type: "UpdatePlan",
			schemaVersion: 1,
			otuId: otu.id,
			expectedVersion: otu.version,
			payload: {
				molecule: {
					type: values.moleculeType as OtuV2MoleculeType,
					strandedness: values.strandedness as OtuV2Strandedness,
					topology: values.topology as OtuV2Topology,
				},
				plan: {
					id: otu.plan.id,
					segments: values.segments.map((segment) => ({
						id: segment.id,
						name:
							segment.namePrefix.trim() || segment.nameKey.trim()
								? { prefix: segment.namePrefix, key: segment.nameKey }
								: null,
						length: segment.length,
						lengthTolerance: segment.lengthTolerance,
						rule: segment.rule as OtuV2SegmentRule,
					})),
				},
			},
		};
		const parsed = UpdateLocalOtuPlanCommand.safeParse(command);
		if (!parsed.success) {
			setValidationError(parsed.error.issues[0]?.message ?? "Invalid plan.");
			return;
		}
		const currentRevision = revision.current;
		try {
			const result = await previewMutation.mutateAsync(parsed.data);
			if (revision.current === currentRevision) {
				setPreview({ command: parsed.data, result });
			}
		} catch {
			// The request error is shown by the mutation below.
		}
	}

	function onSave() {
		if (
			!preview ||
			preview.result.isolates.some((isolate) => isolate.issues.length > 0)
		) {
			return;
		}
		saveMutation.mutate(preview.command, {
			onSuccess: () => closeDialog(false),
		});
	}

	return (
		<>
			{canModify && (
				<Button color="gray" onClick={() => setOpen(true)}>
					Edit molecule and plan
				</Button>
			)}
			<Dialog open={open} onOpenChange={closeDialog}>
				<DialogContent size="lg">
					<DialogTitle>Edit molecule and segment plan</DialogTitle>
					<form onChange={invalidatePreview} onSubmit={handleSubmit(onPreview)}>
						<div className="grid grid-cols-3 gap-3">
							{(
								[
									[
										"moleculeType",
										"Molecule type",
										Object.values(OtuV2MoleculeType),
									],
									[
										"strandedness",
										"Strandedness",
										Object.values(OtuV2Strandedness),
									],
									["topology", "Topology", Object.values(OtuV2Topology)],
								] as const
							).map(([field, label, options]) => (
								<InputGroup key={field}>
									<InputLabel htmlFor={`plan-${field}`}>{label}</InputLabel>
									<select
										id={`plan-${field}`}
										className={selectClasses}
										{...register(field)}
									>
										{options.map((option) => (
											<option key={option} value={option}>
												{option}
											</option>
										))}
									</select>
								</InputGroup>
							))}
						</div>
						{fields.map((field, index) => (
							<fieldset
								key={field.fieldKey}
								className="mb-3 rounded border border-slate-200 p-3"
							>
								<legend className="font-semibold">Segment {index + 1}</legend>
								<div className="grid grid-cols-2 gap-3">
									<InputGroup>
										<InputLabel htmlFor={`${field.fieldKey}-prefix`}>
											Name prefix
										</InputLabel>
										<InputSimple
											id={`${field.fieldKey}-prefix`}
											{...register(
												`segments.${index}.namePrefix` as "segments.0.namePrefix",
											)}
										/>
									</InputGroup>
									<InputGroup>
										<InputLabel htmlFor={`${field.fieldKey}-key`}>
											Name key
										</InputLabel>
										<InputSimple
											id={`${field.fieldKey}-key`}
											{...register(
												`segments.${index}.nameKey` as "segments.0.nameKey",
											)}
										/>
									</InputGroup>
									<InputGroup>
										<InputLabel htmlFor={`${field.fieldKey}-length`}>
											Expected length
										</InputLabel>
										<InputSimple
											id={`${field.fieldKey}-length`}
											type="number"
											min={1}
											{...register(
												`segments.${index}.length` as "segments.0.length",
												{
													valueAsNumber: true,
													required: "Required field",
													min: 1,
												},
											)}
										/>
										<InputError>
											{errors.segments?.[index]?.length?.message}
										</InputError>
									</InputGroup>
									<InputGroup>
										<InputLabel htmlFor={`${field.fieldKey}-tolerance`}>
											Length tolerance
										</InputLabel>
										<InputSimple
											id={`${field.fieldKey}-tolerance`}
											type="number"
											min={0}
											max={1}
											step="any"
											{...register(
												`segments.${index}.lengthTolerance` as "segments.0.lengthTolerance",
												{ valueAsNumber: true, min: 0, max: 1 },
											)}
										/>
										<InputError>
											{errors.segments?.[index]?.lengthTolerance?.message}
										</InputError>
									</InputGroup>
									<InputGroup>
										<InputLabel htmlFor={`${field.fieldKey}-rule`}>
											Rule
										</InputLabel>
										<select
											id={`${field.fieldKey}-rule`}
											className={selectClasses}
											{...register(
												`segments.${index}.rule` as "segments.0.rule",
											)}
										>
											{Object.values(OtuV2SegmentRule).map((rule) => (
												<option key={rule} value={rule}>
													{rule}
												</option>
											))}
										</select>
									</InputGroup>
								</div>
								<Button
									type="button"
									color="red"
									onClick={() => {
										remove(index);
										invalidatePreview();
									}}
									disabled={fields.length === 1}
								>
									Remove segment {index + 1}
								</Button>
							</fieldset>
						))}
						<Button
							type="button"
							color="gray"
							onClick={() => {
								append({
									id: crypto.randomUUID(),
									namePrefix: "",
									nameKey: "",
									length: 1,
									lengthTolerance: 0,
									rule: OtuV2SegmentRule.required,
								});
								invalidatePreview();
							}}
						>
							Add segment
						</Button>
						{validationError && <InputError>{validationError}</InputError>}
						{previewMutation.isError && (
							<InputError>{previewMutation.error.message}</InputError>
						)}
						<div className="mt-4">
							<Button
								type="submit"
								color="blue"
								disabled={previewMutation.isPending || saveMutation.isPending}
							>
								Preview affected isolates
							</Button>
						</div>
					</form>
					{preview && (
						<section className="mt-4" aria-label="Plan impact preview">
							<h3 className="font-semibold">
								Affected isolates ({preview.result.isolates.length})
							</h3>
							{preview.result.isolates.length === 0 && (
								<p>No isolates remain.</p>
							)}
							<ul>
								{preview.result.isolates.map((isolate) => (
									<li key={isolate.isolateId}>
										{formatV2IsolateName(isolate.name)}:{" "}
										{isolate.issues.length === 0
											? "Valid"
											: isolate.issues.join("; ")}
									</li>
								))}
							</ul>
							{preview.result.isolates.some(
								(isolate) => isolate.issues.length > 0,
							) && (
								<InputError>
									Resolve every isolate issue before saving.
								</InputError>
							)}
							{saveMutation.isError && (
								<InputError>{saveMutation.error.message}</InputError>
							)}
							<Button
								color="blue"
								onClick={onSave}
								disabled={
									saveMutation.isPending ||
									preview.result.isolates.some(
										(isolate) => isolate.issues.length > 0,
									)
								}
							>
								Save molecule and plan
							</Button>
						</section>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
