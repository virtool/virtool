import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { formatV2IsolateName } from "@otus-v2/isolateName";
import {
	useAllowLocalOtuAccession,
	useExcludeLocalOtuAccession,
	usePreviewExcludeLocalOtuAccession,
} from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import {
	ExcludeLocalOtuAccessionCommand,
	type ExcludeLocalOtuAccessionCommandInput,
	type LocalOtuV2AccessionExclusionPreview,
	type LocalOtuV2Overview,
} from "@virtool/contracts";
import { useRef, useState } from "react";

/** List excluded bases and review the isolate impact before excluding another. */
export default function LocalOtuAccessionExclusions({
	referenceId,
	otu,
}: {
	referenceId: string;
	otu: LocalOtuV2Overview;
}) {
	const canModify = useCanModifyReferenceV2Otus(referenceId);
	const [accessionBase, setAccessionBase] = useState("");
	const [inputError, setInputError] = useState<string>();
	const [preview, setPreview] = useState<{
		command: ExcludeLocalOtuAccessionCommandInput;
		result: LocalOtuV2AccessionExclusionPreview;
	}>();
	const revision = useRef(0);
	const previewMutation = usePreviewExcludeLocalOtuAccession(referenceId);
	const excludeMutation = useExcludeLocalOtuAccession(referenceId);
	const allowMutation = useAllowLocalOtuAccession(referenceId);

	function invalidatePreview() {
		revision.current += 1;
		setPreview(undefined);
		setInputError(undefined);
		previewMutation.reset();
		excludeMutation.reset();
	}

	async function onPreview(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		invalidatePreview();
		const parsed = ExcludeLocalOtuAccessionCommand.safeParse({
			type: "ExcludeAccession",
			schemaVersion: 1,
			otuId: otu.id,
			expectedVersion: otu.version,
			payload: { accessionBase },
		});
		if (!parsed.success) {
			setInputError("Enter an accession base without its version suffix.");
			return;
		}
		const currentRevision = revision.current;
		try {
			const result = await previewMutation.mutateAsync(parsed.data);
			if (revision.current === currentRevision) {
				setPreview({ command: parsed.data, result });
			}
		} catch {
			// The mutation error appears below.
		}
	}

	function onExclude() {
		if (!preview?.result.canExclude) {
			return;
		}
		excludeMutation.mutate(preview.command, {
			onSuccess: () => {
				invalidatePreview();
				setAccessionBase("");
			},
		});
	}

	function onAllow(base: string) {
		allowMutation.mutate(
			{
				type: "AllowAccession",
				schemaVersion: 1,
				otuId: otu.id,
				expectedVersion: otu.version,
				payload: { accessionBase: base },
			},
			{ onSuccess: invalidatePreview },
		);
	}

	return (
		<>
			{otu.excludedAccessionBases.length === 0 ? (
				<p>No excluded accession bases.</p>
			) : (
				<ul>
					{otu.excludedAccessionBases.map((base) => (
						<li key={base} className="flex items-center gap-3 py-1">
							<span className="font-mono">{base}</span>
							{canModify && (
								<Button
									type="button"
									color="gray"
									onClick={() => onAllow(base)}
									disabled={allowMutation.isPending}
								>
									Allow {base}
								</Button>
							)}
						</li>
					))}
				</ul>
			)}
			{allowMutation.isError && (
				<InputError>{allowMutation.error.message}</InputError>
			)}
			{canModify && (
				<form className="mt-4" onSubmit={onPreview}>
					<InputGroup>
						<InputLabel htmlFor="exclude-accession-base">
							Accession base
						</InputLabel>
						<InputSimple
							id="exclude-accession-base"
							value={accessionBase}
							onChange={(event) => {
								setAccessionBase(event.target.value);
								invalidatePreview();
							}}
							placeholder="NC_001367"
						/>
					</InputGroup>
					<p className="mb-3 text-sm text-slate-600">
						Excluding a current GenBank accession retires its entire isolate,
						including all segments. Future imports of the base are blocked.
						Allowing it later does not restore the isolate.
					</p>
					{inputError && <InputError>{inputError}</InputError>}
					{previewMutation.isError && (
						<InputError>{previewMutation.error.message}</InputError>
					)}
					<Button
						type="submit"
						color="gray"
						disabled={previewMutation.isPending || excludeMutation.isPending}
					>
						Preview exclusion
					</Button>
				</form>
			)}
			{preview && (
				<section aria-label="Accession exclusion preview" className="mt-3">
					<p>Exclude {preview.result.accessionBase}</p>
					{preview.result.retiredIsolate ? (
						<p>
							Will retire{" "}
							{formatV2IsolateName(preview.result.retiredIsolate.name)} and all
							its sequences.
						</p>
					) : (
						<p>No current isolate uses this accession base.</p>
					)}
					{!preview.result.canExclude && (
						<InputError>
							This is the last isolate. Add another isolate before excluding
							this accession.
						</InputError>
					)}
					{excludeMutation.isError && (
						<InputError>{excludeMutation.error.message}</InputError>
					)}
					<Button
						type="button"
						color="red"
						onClick={onExclude}
						disabled={!preview.result.canExclude || excludeMutation.isPending}
					>
						Confirm exclusion
					</Button>
				</section>
			)}
		</>
	);
}
