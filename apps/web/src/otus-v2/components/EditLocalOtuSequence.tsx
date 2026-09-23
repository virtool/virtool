import { cn } from "@app/cn";
import Button from "@base/Button";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { inputBaseClasses, inputHeightClass } from "@base/styles";
import TextArea from "@base/TextArea";
import MissingRecommendedAcknowledgement from "@otus-v2/components/MissingRecommendedAcknowledgement";
import { formatV2IsolateName } from "@otus-v2/isolateName";
import {
	usePreviewLocalOtuSequence,
	useUpdateLocalOtuSequence,
} from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import {
	type LocalOtuV2Sequence,
	type LocalOtuV2SequencePreview,
	type OtuV2Plan,
	UpdateLocalOtuSequenceCommand,
	type UpdateLocalOtuSequenceCommandInput,
} from "@virtool/contracts";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
	definition: string;
	sequence: string;
	segmentId: string;
	source: "manual" | "genbank";
};

/** Review the source and every isolate before saving a sequence edit. */
export default function EditLocalOtuSequence({
	referenceId,
	otuId,
	isolateId,
	version,
	plan,
	sequence,
}: {
	referenceId: string;
	otuId: string;
	isolateId: string;
	version: number;
	plan: OtuV2Plan;
	sequence: LocalOtuV2Sequence;
}) {
	const canModify = useCanModifyReferenceV2Otus(referenceId);
	const [open, setOpen] = useState(false);
	const [preview, setPreview] = useState<{
		command: UpdateLocalOtuSequenceCommandInput;
		result: LocalOtuV2SequencePreview;
	}>();
	const [validationError, setValidationError] = useState<string>();
	const [acknowledged, setAcknowledged] = useState(false);
	const revision = useRef(0);
	const previewMutation = usePreviewLocalOtuSequence(referenceId);
	const saveMutation = useUpdateLocalOtuSequence(referenceId);
	const { register, handleSubmit, reset, setValue } = useForm<FormValues>({
		values: {
			definition: sequence.definition,
			sequence: sequence.sequence,
			segmentId: sequence.segmentId,
			source: sequence.source,
		},
	});
	const sequenceField = register("sequence");

	function invalidatePreview() {
		revision.current += 1;
		setAcknowledged(false);
		setPreview(undefined);
		setValidationError(undefined);
		previewMutation.reset();
		saveMutation.reset();
	}

	function closeDialog(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			invalidatePreview();
			reset();
		}
	}

	async function onPreview(values: FormValues) {
		invalidatePreview();
		const command: UpdateLocalOtuSequenceCommandInput = {
			type: "UpdateSequence",
			schemaVersion: 1,
			otuId,
			expectedVersion: version,
			payload: {
				isolateId,
				sequenceId: sequence.id,
				segmentId: values.segmentId,
				definition: values.definition,
				sequence: values.sequence,
				source: values.source,
				accessionVersion:
					values.source === "genbank" ? sequence.accessionVersion : null,
			},
		};
		const parsed = UpdateLocalOtuSequenceCommand.safeParse(command);
		if (!parsed.success) {
			setValidationError(
				parsed.error.issues[0]?.message ?? "Invalid sequence.",
			);
			return;
		}
		const currentRevision = revision.current;
		try {
			const result = await previewMutation.mutateAsync(parsed.data);
			if (revision.current === currentRevision) {
				setPreview({ command: parsed.data, result });
			}
		} catch {
			// The request error is displayed by the mutation below.
		}
	}

	function onSave() {
		const missing =
			preview?.result.isolates
				.filter((isolate) => isolate.isolateId === isolateId)
				.flatMap((isolate) =>
					isolate.missingRecommendedSegmentIds.map((segmentId) => ({
						isolateId: isolate.isolateId,
						segmentId,
					})),
				) ?? [];
		if (
			!preview ||
			(missing.length > 0 && !acknowledged) ||
			preview.result.provenanceIssues.length > 0 ||
			preview.result.isolates.some((isolate) => isolate.issues.length > 0)
		) {
			return;
		}
		saveMutation.mutate(
			{
				...preview.command,
				payload: {
					...preview.command.payload,
					acknowledgedMissingRecommendedSegments: missing,
				},
			},
			{
				onSuccess: () => closeDialog(false),
			},
		);
	}

	return (
		<>
			{canModify && (
				<Button color="gray" onClick={() => setOpen(true)}>
					Edit sequence
				</Button>
			)}
			<Dialog open={open} onOpenChange={closeDialog}>
				<DialogContent size="lg">
					<DialogTitle>Edit sequence</DialogTitle>
					<form onChange={invalidatePreview} onSubmit={handleSubmit(onPreview)}>
						<InputGroup>
							<InputLabel htmlFor="edit-sequence-definition">
								Definition
							</InputLabel>
							<InputSimple
								id="edit-sequence-definition"
								{...register("definition")}
							/>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor="edit-sequence-segment">Segment</InputLabel>
							<select
								id="edit-sequence-segment"
								className={cn(inputBaseClasses, inputHeightClass)}
								{...register("segmentId")}
							>
								{plan.segments.map((segment, index) => (
									<option key={segment.id} value={segment.id}>
										{segment.name
											? `${segment.name.prefix} ${segment.name.key}`
											: `Segment ${index + 1}`}
									</option>
								))}
							</select>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor="edit-sequence-bases">
								Sequence bases
							</InputLabel>
							<TextArea
								id="edit-sequence-bases"
								{...sequenceField}
								onChange={(event) => {
									sequenceField.onChange(event);
									if (
										event.target.value.replace(/\s/g, "").toUpperCase() !==
										sequence.sequence
									) {
										setValue("source", "manual");
									}
								}}
							/>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor="edit-sequence-source">
								Source after edit
							</InputLabel>
							<select
								id="edit-sequence-source"
								className={cn(inputBaseClasses, inputHeightClass)}
								{...register("source")}
							>
								<option value="manual">Manual, no accession</option>
								<option
									value="genbank"
									disabled={sequence.source !== "genbank"}
								>
									GenBank, keep exact accession
								</option>
							</select>
						</InputGroup>
						<p className="mb-3 text-sm text-slate-600">
							GenBank source describes unchanged bases from{" "}
							{sequence.accessionVersion ?? "the current record"}. Changed bases
							become manual and clear the accession.
						</p>
						{validationError && <InputError>{validationError}</InputError>}
						{previewMutation.isError && (
							<InputError>{previewMutation.error.message}</InputError>
						)}
						<Button
							type="submit"
							color="blue"
							disabled={previewMutation.isPending || saveMutation.isPending}
						>
							Preview affected isolates
						</Button>
					</form>
					{preview && (
						<section aria-label="Sequence impact preview" className="mt-4">
							<h3 className="font-semibold">
								After save:{" "}
								{preview.result.source === "genbank"
									? `GenBank ${preview.result.accessionVersion}`
									: "manual, no accession"}
							</h3>
							{preview.result.provenanceIssues.map((issue) => (
								<InputError key={issue}>{issue}</InputError>
							))}
							<h4>Affected isolates ({preview.result.isolates.length})</h4>
							<ul>
								{preview.result.isolates.map((isolate) => (
									<li key={isolate.isolateId}>
										{formatV2IsolateName(isolate.name)}:{" "}
										{isolate.issues.length
											? isolate.issues.join("; ")
											: "Valid"}
									</li>
								))}
							</ul>
							<MissingRecommendedAcknowledgement
								items={preview.result.isolates
									.filter((isolate) => isolate.isolateId === isolateId)
									.flatMap((isolate) =>
										isolate.missingRecommendedSegmentIds.map((segmentId) => {
											const segment = plan.segments.find(
												(item) => item.id === segmentId,
											);
											return {
												isolateId: isolate.isolateId,
												isolateName: isolate.name,
												segmentId,
												segmentName: segment?.name
													? `${segment.name.prefix} ${segment.name.key}`
													: `Segment ${plan.segments.findIndex((item) => item.id === segmentId) + 1}`,
											};
										}),
									)}
								checked={acknowledged}
								onChange={setAcknowledged}
							/>
							{saveMutation.isError && (
								<InputError>{saveMutation.error.message}</InputError>
							)}
							<Button
								color="blue"
								onClick={onSave}
								disabled={
									saveMutation.isPending ||
									(preview.result.isolates.some(
										(isolate) =>
											isolate.isolateId === isolateId &&
											isolate.missingRecommendedSegmentIds.length > 0,
									) &&
										!acknowledged) ||
									preview.result.provenanceIssues.length > 0 ||
									preview.result.isolates.some(
										(isolate) => isolate.issues.length > 0,
									)
								}
							>
								Save sequence
							</Button>
						</section>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
