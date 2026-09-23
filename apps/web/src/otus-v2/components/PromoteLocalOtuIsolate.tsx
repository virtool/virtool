import Button from "@base/Button";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import {
	usePreviewLocalOtuPromotion,
	usePromoteLocalOtuIsolate,
} from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import {
	type LocalOtuV2PromotionPreview,
	PromoteLocalOtuIsolateCommand,
} from "@virtool/contracts";
import { useRef, useState } from "react";

/** Review and explicitly approve every NCBI change to an isolate. */
export default function PromoteLocalOtuIsolate({
	referenceId,
	otuId,
	isolateId,
	version,
}: {
	referenceId: string;
	otuId: string;
	isolateId: string;
	version: number;
}) {
	const canModify = useCanModifyReferenceV2Otus(referenceId);
	const [open, setOpen] = useState(false);
	const [preview, setPreview] = useState<LocalOtuV2PromotionPreview>();
	const [approved, setApproved] = useState<string[]>([]);
	const revision = useRef(0);
	const previewMutation = usePreviewLocalOtuPromotion(referenceId, otuId);
	const saveMutation = usePromoteLocalOtuIsolate(referenceId);
	const changed =
		preview?.sequences.filter((item) => item.kind !== "unchanged") ?? [];
	const canSave =
		preview &&
		preview.expectedVersion === version &&
		preview.issues.length === 0 &&
		changed.length > 0 &&
		changed.every((item) => approved.includes(item.sequenceId));

	function close(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			revision.current += 1;
			setPreview(undefined);
			setApproved([]);
			previewMutation.reset();
			saveMutation.reset();
		}
	}

	async function onPreview() {
		revision.current += 1;
		const currentRevision = revision.current;
		setPreview(undefined);
		setApproved([]);
		try {
			const result = await previewMutation.mutateAsync({
				isolateId,
				expectedVersion: version,
			});
			if (revision.current === currentRevision) {
				setPreview(result);
			}
		} catch {
			// Request error is shown below.
		}
	}

	function onSave() {
		if (!preview || !canSave) {
			return;
		}
		const parsed = PromoteLocalOtuIsolateCommand.safeParse({
			type: "PromoteIsolate",
			schemaVersion: 1,
			otuId,
			expectedVersion: preview.expectedVersion,
			payload: {
				isolateId,
				proposedTaxonomy: preview.proposedTaxonomy,
				sequences: preview.sequences.map((item) => ({
					sequenceId: item.sequenceId,
					segmentId: item.segmentId,
					previousAccessionVersion: item.previousAccessionVersion,
					accessionVersion: item.accessionVersion,
					definition: item.definition,
					sequence: item.sequence,
					proposedSegment: item.proposedSegment,
					approved:
						item.kind !== "unchanged" && approved.includes(item.sequenceId),
				})),
			},
		});
		if (parsed.success) {
			saveMutation.mutate(parsed.data, { onSuccess: () => close(false) });
		}
	}

	if (!canModify) {
		return null;
	}
	return (
		<>
			<Button color="gray" onClick={() => setOpen(true)}>
				Check NCBI updates
			</Button>
			<Dialog open={open} onOpenChange={close}>
				<DialogContent size="lg">
					<DialogTitle>Review NCBI isolate updates</DialogTitle>
					<p className="mb-3">
						NCBI changes to every segment are reviewed together. Approve each
						changed accession before saving.
					</p>
					<Button
						color="gray"
						onClick={onPreview}
						disabled={previewMutation.isPending}
					>
						Check NCBI
					</Button>
					{previewMutation.isError && (
						<p role="alert">{previewMutation.error.message}</p>
					)}
					{preview && (
						<>
							<div className="my-3 rounded border p-3">
								<p>
									Taxonomy: {preview.currentTaxonomy.name} →{" "}
									{preview.proposedTaxonomy.name}
								</p>
								<p>
									Lineage:{" "}
									{preview.currentTaxonomy.lineage
										.map((item) => item.name)
										.join(" › ")}{" "}
									→{" "}
									{preview.proposedTaxonomy.lineage
										.map((item) => item.name)
										.join(" › ")}
								</p>
							</div>
							{preview.issues.map((issue) => (
								<p key={issue} role="alert">
									{issue}
								</p>
							))}
							{preview.sequences.map((item) => (
								<div key={item.sequenceId} className="my-3 rounded border p-3">
									<p>
										<strong>
											{item.segmentName
												? `${item.segmentName.prefix} ${item.segmentName.key}`
												: "Unnamed segment"}
										</strong>{" "}
										· NCBI segment: {item.proposedSegment ?? "unspecified"}
									</p>
									<p>
										{item.kind}: {item.previousAccessionVersion} →{" "}
										{item.accessionVersion}
									</p>
									<p>
										Length: {item.previousLength} → {item.length} bases.
										Sequence {item.sequenceChanged ? "changed" : "unchanged"}.
									</p>
									<p>
										Definition: {item.previousDefinition} → {item.definition}
									</p>
									{item.sequenceChanged && (
										<details>
											<summary>Compare sequence bases</summary>
											<p>Current</p>
											<pre className="overflow-auto whitespace-pre-wrap break-all">
												{item.previousSequence}
											</pre>
											<p>Proposed</p>
											<pre className="overflow-auto whitespace-pre-wrap break-all">
												{item.sequence}
											</pre>
										</details>
									)}
									{item.kind !== "unchanged" && (
										<label>
											<input
												type="checkbox"
												checked={approved.includes(item.sequenceId)}
												onChange={(event) =>
													setApproved((previous) =>
														event.target.checked
															? [...previous, item.sequenceId]
															: previous.filter((id) => id !== item.sequenceId),
													)
												}
											/>{" "}
											Approve this {item.kind}
										</label>
									)}
								</div>
							))}
							<Button
								onClick={onSave}
								disabled={!canSave || saveMutation.isPending}
							>
								Save approved updates
							</Button>
							{saveMutation.isError && (
								<p role="alert">{saveMutation.error.message}</p>
							)}
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
