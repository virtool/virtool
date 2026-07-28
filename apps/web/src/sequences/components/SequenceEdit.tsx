import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { useEditSequence } from "@otus/queries";
import type { OtuSegment, OtuSequence } from "@virtool/contracts";
import { compact } from "es-toolkit";
import SequenceForm from "./SequenceForm";

type FormValues = {
	accession: string;
	definition: string;
	host: string;
	segment: string | null;
	sequence: string;
};

type SequenceEditProps = {
	activeSequence?: OtuSequence;
	isolateId: string;
	open?: boolean;
	otuId: string;
	refId: string;
	schema: OtuSegment[];
	sequences: OtuSequence[];
	setOpen?: (open: boolean) => void;
};

/**
 * Displays dialog to edit a genome sequence
 */
export default function SequenceEdit({
	activeSequence,
	isolateId,
	open = false,
	otuId,
	refId,
	schema,
	sequences,
	setOpen = () => {},
}: SequenceEditProps) {
	const mutation = useEditSequence(otuId);

	const referencedSegmentNames = compact(
		sequences
			.filter((seq) => seq.id !== activeSequence?.id)
			.map((seq) => seq.segment),
	);

	const segments = schema.filter(
		(segment) => !referencedSegmentNames.includes(segment.name),
	);

	function onSubmit({
		accession,
		definition,
		host,
		sequence,
		segment,
	}: FormValues) {
		if (!activeSequence) {
			return;
		}

		mutation.mutate(
			{
				isolateId,
				sequenceId: activeSequence.id,
				accession,
				definition,
				host,
				segment,
				sequence,
			},
			{
				onSuccess: () => {
					setOpen(false);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogTitle>Edit Sequence</DialogTitle>
				<SequenceForm
					activeSequence={activeSequence}
					hasSchema={schema.length > 0}
					onSubmit={onSubmit}
					otuId={otuId}
					refId={refId}
					segments={segments}
				/>
			</DialogContent>
		</Dialog>
	);
}
