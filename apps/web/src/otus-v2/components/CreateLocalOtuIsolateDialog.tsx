import { cn } from "@app/cn";
import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { inputBaseClasses, inputHeightClass } from "@base/styles";
import TextArea from "@base/TextArea";
import { buildCreateIsolateCommand } from "@otus-v2/command";
import { getIsolateNameTypeLabel } from "@otus-v2/isolateName";
import {
	useCreateLocalOtuIsolate,
	useGenbankIsolateDraft,
} from "@otus-v2/queries";
import {
	type GenbankIsolateDraft,
	OtuV2IsolateNameType,
	OtuV2IsolatePlan,
	type OtuV2Plan,
} from "@virtool/contracts";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = { accessions: string };
type ManualFormValues = {
	isolateNameType: string;
	isolateNameValue: string;
	sequences: Array<{ definition: string; sequence: string }>;
};

function parseAccessions(value: string): string[] {
	return Array.from(new Set(value.split(/[\s,]+/).filter(Boolean)));
}

/** Dialog for previewing and creating an isolate from NCBI accessions. */
export default function CreateLocalOtuIsolateDialog({
	open,
	setOpen,
	referenceId,
	otuId,
	version,
	plan,
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
	referenceId: string;
	otuId: string;
	version: number;
	plan: OtuV2Plan;
}) {
	const [mode, setMode] = useState<"manual" | "genbank">("manual");
	const [preview, setPreview] = useState<GenbankIsolateDraft>();
	const previewRevision = useRef(0);
	const accessionsId = useId();
	const previewMutation = useGenbankIsolateDraft(referenceId, otuId);
	const createMutation = useCreateLocalOtuIsolate(referenceId);
	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
	} = useForm<FormValues>();

	function close(next: boolean) {
		setOpen(next);
		if (!next) {
			setMode("manual");
			previewRevision.current += 1;
			setPreview(undefined);
			previewMutation.reset();
			createMutation.reset();
			reset();
		}
	}

	function invalidatePreview() {
		previewRevision.current += 1;
		setPreview(undefined);
		previewMutation.reset();
		createMutation.reset();
	}

	function previewSubmit(values: FormValues) {
		invalidatePreview();
		const revision = previewRevision.current;
		previewMutation.mutate(parseAccessions(values.accessions), {
			onSuccess: (draft) => {
				if (revision === previewRevision.current) {
					setPreview(draft);
				}
			},
		});
	}

	function commit() {
		if (!preview) return;
		createMutation.mutate(buildCreateIsolateCommand(preview, otuId, version), {
			onSuccess: () => close(false),
		});
	}

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent size="lg">
				<DialogTitle>Create isolate</DialogTitle>
				<DialogDescription>
					Enter sequences manually or look up GenBank accessions.
				</DialogDescription>
				<div className="flex gap-2">
					<Button
						type="button"
						color={mode === "manual" ? "blue" : "gray"}
						onClick={() => {
							invalidatePreview();
							setMode("manual");
						}}
					>
						Manual entry
					</Button>
					<Button
						type="button"
						color={mode === "genbank" ? "blue" : "gray"}
						onClick={() => setMode("genbank")}
					>
						GenBank accessions
					</Button>
				</div>
				{mode === "manual" ? (
					<ManualIsolateForm
						plan={plan}
						otuId={otuId}
						version={version}
						referenceId={referenceId}
						onCreated={() => close(false)}
					/>
				) : (
					<>
						<form onSubmit={handleSubmit(previewSubmit)}>
							<InputGroup>
								<InputLabel htmlFor={accessionsId}>NCBI accessions</InputLabel>
								<TextArea
									id={accessionsId}
									placeholder="NC_004452.3"
									{...register("accessions", {
										required: "Enter at least one accession.",
										validate: (value) =>
											parseAccessions(value).length > 0 ||
											"Enter at least one accession.",
										onChange: invalidatePreview,
									})}
								/>
								<InputError>{errors.accessions?.message}</InputError>
							</InputGroup>
							<p className="text-slate-600">
								Separate multiple segment accessions with spaces, commas, or new
								lines.
							</p>
							<DialogFooter>
								<Button
									color="blue"
									type="submit"
									disabled={previewMutation.isPending}
								>
									Preview
								</Button>
							</DialogFooter>
						</form>

						{previewMutation.isError && (
							<InputError>{previewMutation.error.message}</InputError>
						)}
						{preview && (
							<div className="mt-4 rounded border border-slate-200 p-4">
								<h3 className="font-semibold">Preview</h3>
								<p className="mb-3">
									{preview.name
										? `${getIsolateNameTypeLabel(preview.name.type)}: ${preview.name.value}`
										: "Unnamed isolate"}
								</p>
								<div className="divide-y divide-slate-200">
									{preview.sequences.map((sequence) => (
										<div className="py-2" key={sequence.accession}>
											<div className="font-mono text-sm">
												{sequence.accession}
											</div>
											<div>
												{sequence.name
													? `${sequence.name.prefix} ${sequence.name.key}`
													: "Unsegmented"}{" "}
												· {sequence.length} bases
											</div>
											<div className="truncate text-sm text-slate-600">
												{sequence.definition}
											</div>
										</div>
									))}
								</div>
								{createMutation.isError && (
									<InputError>{createMutation.error.message}</InputError>
								)}
								<DialogFooter>
									<Button
										color="blue"
										onClick={commit}
										disabled={createMutation.isPending}
									>
										Create isolate
									</Button>
								</DialogFooter>
							</div>
						)}
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

function ManualIsolateForm({
	plan,
	otuId,
	version,
	referenceId,
	onCreated,
}: {
	plan: OtuV2Plan;
	otuId: string;
	version: number;
	referenceId: string;
	onCreated: () => void;
}) {
	const [planError, setPlanError] = useState<string>();
	const nameTypeId = useId();
	const nameId = useId();
	const createMutation = useCreateLocalOtuIsolate(referenceId);
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ManualFormValues>({
		defaultValues: {
			isolateNameType: OtuV2IsolateNameType.isolate,
			isolateNameValue: "",
			sequences: plan.segments.map(() => ({ definition: "", sequence: "" })),
		},
	});

	function onSubmit(values: ManualFormValues) {
		setPlanError(undefined);
		const nameValue = values.isolateNameValue.trim();
		const isolate = {
			id: crypto.randomUUID(),
			name: nameValue
				? {
						type: values.isolateNameType as OtuV2IsolateNameType,
						value: nameValue,
					}
				: null,
			sequences: plan.segments.flatMap((segment, index) => {
				const entry = values.sequences[index];
				if (!entry?.sequence.trim()) {
					return [];
				}
				return [
					{
						id: crypto.randomUUID(),
						definition: entry.definition,
						sequence: entry.sequence,
						segmentId: segment.id,
					},
				];
			}),
		};
		const result = OtuV2IsolatePlan.safeParse({ plan, isolate });
		if (!result.success) {
			setPlanError(result.error.issues[0]?.message ?? "Invalid isolate.");
			return;
		}
		createMutation.mutate(
			{
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId,
				expectedVersion: version,
				payload: { isolate: result.data.isolate },
			},
			{ onSuccess: onCreated },
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<div className="grid grid-cols-2 gap-4">
				<InputGroup>
					<InputLabel htmlFor={nameTypeId}>Isolate name type</InputLabel>
					<select
						id={nameTypeId}
						className={cn(inputBaseClasses, inputHeightClass)}
						{...register("isolateNameType")}
					>
						{Object.values(OtuV2IsolateNameType).map((type) => (
							<option key={type} value={type}>
								{getIsolateNameTypeLabel(type)}
							</option>
						))}
					</select>
				</InputGroup>
				<InputGroup>
					<InputLabel htmlFor={nameId}>Isolate name</InputLabel>
					<InputSimple id={nameId} {...register("isolateNameValue")} />
				</InputGroup>
			</div>
			{plan.segments.map((segment, index) => {
				const label = segment.name
					? `${segment.name.prefix} ${segment.name.key}`
					: "Genome";
				return (
					<div key={segment.id}>
						<h3 className="font-semibold">
							{label} ({segment.rule})
						</h3>
						<InputGroup>
							<InputLabel htmlFor={`manual-definition-${segment.id}`}>
								{label} definition
							</InputLabel>
							<InputSimple
								id={`manual-definition-${segment.id}`}
								{...register(`sequences.${index}.definition`, {
									validate: (value, form) =>
										!form.sequences[index]?.sequence.trim() ||
										Boolean(value.trim()) ||
										"Required when a sequence is entered.",
								})}
							/>
							<InputError>
								{errors.sequences?.[index]?.definition?.message}
							</InputError>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor={`manual-sequence-${segment.id}`}>
								{label} sequence
							</InputLabel>
							<TextArea
								id={`manual-sequence-${segment.id}`}
								{...register(`sequences.${index}.sequence`, {
									required:
										segment.rule === "required" ? "Required segment." : false,
								})}
							/>
							<InputError>
								{errors.sequences?.[index]?.sequence?.message}
							</InputError>
						</InputGroup>
					</div>
				);
			})}
			{planError && <InputError>{planError}</InputError>}
			{createMutation.isError && (
				<InputError>{createMutation.error.message}</InputError>
			)}
			<DialogFooter>
				<Button color="blue" type="submit" disabled={createMutation.isPending}>
					Create isolate
				</Button>
			</DialogFooter>
		</form>
	);
}
