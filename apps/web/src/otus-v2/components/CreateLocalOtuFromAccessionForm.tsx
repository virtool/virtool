import Button from "@base/Button";
import { InputError, InputGroup, InputLabel } from "@base/Input";
import TextArea from "@base/TextArea";
import { buildCreateOtuCommandFromDraft } from "@otus-v2/command";
import { getIsolateNameTypeLabel } from "@otus-v2/isolateName";
import { useCreateLocalOtu, useGenbankOtuDraft } from "@otus-v2/queries";
import { useNavigate } from "@tanstack/react-router";
import type { GenbankOtuDraft } from "@virtool/contracts";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
	accessions: string;
};

function parseAccessions(value: string): string[] {
	return Array.from(new Set(value.split(/[\s,]+/).filter(Boolean)));
}

/**
 * Preview NCBI records before creating a complete local OTU.
 */
export default function CreateLocalOtuFromAccessionForm({
	referenceId,
	defaultSegmentLengthTolerance,
}: {
	referenceId: string;
	defaultSegmentLengthTolerance: number;
}) {
	const navigate = useNavigate();
	const previewMutation = useGenbankOtuDraft(referenceId);
	const createMutation = useCreateLocalOtu(referenceId);
	const [preview, setPreview] = useState<GenbankOtuDraft>();
	const previewRevision = useRef(0);

	const accessionsId = useId();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ defaultValues: { accessions: "" } });

	function invalidatePreview() {
		previewRevision.current += 1;
		setPreview(undefined);
		previewMutation.reset();
		createMutation.reset();
	}

	function onSubmit(values: FormValues) {
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

	function confirm() {
		if (!preview) {
			return;
		}
		createMutation.mutate(
			buildCreateOtuCommandFromDraft(preview, defaultSegmentLengthTolerance),
			{
				onSuccess: (otu) => {
					navigate({
						to: "/refs/alpha/$referenceId/otus/$otuId",
						params: { referenceId, otuId: otu.id },
					});
				},
			},
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<InputGroup>
				<InputLabel htmlFor={accessionsId}>Accessions</InputLabel>
				<TextArea
					id={accessionsId}
					placeholder="NC_004452.3"
					aria-required
					aria-invalid={Boolean(errors.accessions) || undefined}
					disabled={createMutation.isPending}
					{...register("accessions", {
						required: "Required Field",
						validate: (value) =>
							parseAccessions(value).length > 0 ||
							"Enter at least one accession.",
						onChange: invalidatePreview,
					})}
				/>
				<InputError>{errors.accessions?.message}</InputError>
			</InputGroup>

			<p>
				List one accession per virus, or every segment's accession for a
				multipartite genome. Separate them with spaces, commas, or new lines.
			</p>

			{previewMutation.isError && (
				<InputError>{previewMutation.error.message}</InputError>
			)}

			<Button
				color="blue"
				type="submit"
				disabled={previewMutation.isPending || createMutation.isPending}
			>
				Preview
			</Button>
			{preview && (
				<div className="mt-4 rounded border border-slate-200 p-4">
					<h3 className="font-semibold">Review OTU</h3>
					<p>
						{preview.taxonomy.name}
						{preview.taxonomy.acronym ? ` (${preview.taxonomy.acronym})` : ""}
					</p>
					<p>
						{preview.molecule.strandedness} {preview.molecule.type} ·{" "}
						{preview.molecule.topology}
					</p>
					<p>
						{preview.isolate
							? `${getIsolateNameTypeLabel(preview.isolate.type)}: ${preview.isolate.value}`
							: "Unnamed isolate"}
					</p>
					<div className="divide-y divide-slate-200">
						{preview.segments.map((segment) => (
							<div className="py-2" key={segment.accession}>
								<div className="font-mono text-sm">{segment.accession}</div>
								<div>
									{segment.name
										? `${segment.name.prefix} ${segment.name.key}`
										: "Unsegmented"}{" "}
									· {segment.length} bases
								</div>
								<div className="truncate text-sm text-slate-600">
									{segment.definition}
								</div>
							</div>
						))}
					</div>
					{createMutation.isError && (
						<InputError>{createMutation.error.message}</InputError>
					)}
					<Button
						color="blue"
						type="button"
						onClick={confirm}
						disabled={createMutation.isPending}
					>
						Create OTU
					</Button>
				</div>
			)}
		</form>
	);
}
