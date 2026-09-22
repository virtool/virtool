import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@base/Dialog";
import { InputError, InputGroup, InputLabel } from "@base/Input";
import TextArea from "@base/TextArea";
import { buildCreateIsolateCommand } from "@otus-v2/command";
import { getIsolateNameTypeLabel } from "@otus-v2/isolateName";
import {
	useCreateLocalOtuIsolate,
	useGenbankIsolateDraft,
} from "@otus-v2/queries";
import type { GenbankIsolateDraft } from "@virtool/contracts";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = { accessions: string };

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
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
	referenceId: string;
	otuId: string;
	version: number;
}) {
	const [preview, setPreview] = useState<GenbankIsolateDraft>();
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
			setPreview(undefined);
			previewMutation.reset();
			createMutation.reset();
			reset();
		}
	}

	function previewSubmit(values: FormValues) {
		previewMutation.mutate(parseAccessions(values.accessions), {
			onSuccess: setPreview,
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
					Look up an isolate in NCBI and review its sequences before creating
					it.
				</DialogDescription>
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
									<div className="font-mono text-sm">{sequence.accession}</div>
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
			</DialogContent>
		</Dialog>
	);
}
