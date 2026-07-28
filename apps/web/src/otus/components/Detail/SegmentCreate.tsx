import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { useUpdateOtu } from "@otus/queries";
import type { Molecule, OtuSegment } from "@virtool/contracts";
import SegmentForm from "./SegmentForm";

type FormValues = {
	segmentName: string;
	molecule: Molecule | "";
	required: boolean;
};

type SegmentCreateProps = {
	abbreviation: string;
	name: string;
	open?: boolean;
	otuId: string;
	/** The segments associated with the otu */
	schema: OtuSegment[];
	setOpen?: (open: boolean) => void;
};

/**
 * Displays a dialog for adding a segment
 */
export default function SegmentCreate({
	otuId,
	name,
	abbreviation,
	open = false,
	schema,
	setOpen = () => {},
}: SegmentCreateProps) {
	const mutation = useUpdateOtu(otuId);

	function handleSubmit({ segmentName, molecule, required }: FormValues) {
		mutation.mutate(
			{
				otuId,
				name,
				abbreviation,
				schema: [
					...schema,
					{ name: segmentName, molecule: molecule || null, required },
				],
			},
			{
				onSuccess: () => {
					setOpen(false);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={() => setOpen(false)}>
			<DialogContent>
				<DialogTitle>Add Segment</DialogTitle>
				<SegmentForm onSubmit={handleSubmit} schema={schema} />
			</DialogContent>
		</Dialog>
	);
}
