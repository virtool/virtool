import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { useCreateSequence } from "@otus/queries";
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

type CreateSequenceProps = {
	isolateId: string;
	open?: boolean;
	otuId: string;
	refId: string;
	schema: OtuSegment[];
	sequences: OtuSequence[];
	setOpen?: (open: boolean) => void;
};

/**
 * Displays dialog to add a genome sequence
 */
export default function CreateSequence({
	isolateId,
	open = false,
	otuId,
	refId,
	schema,
	sequences,
	setOpen = () => {},
}: CreateSequenceProps) {
	const mutation = useCreateSequence(otuId);

	const segments = schema.filter(
		(segment) =>
			!compact(sequences.map((seq) => seq.segment)).includes(segment.name),
	);

	function onSubmit({
		accession,
		definition,
		host,
		sequence,
		segment,
	}: FormValues) {
		mutation.mutate(
			{
				accession,
				definition,
				host,
				isolateId,
				segment,
				sequence: sequence.toUpperCase(),
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
				<DialogTitle>Create Sequence</DialogTitle>
				<SequenceForm
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
