import DeleteDialog from "@base/DeleteDialog";
import { useUpdateOtu } from "@otus/queries";
import type { OtuSegment } from "@virtool/contracts";

type DeleteSegmentProps = {
	abbreviation: string;
	name: string;
	open?: boolean;
	otuId: string;
	schema: OtuSegment[];
	segmentName?: string;
	setOpen?: (open: boolean) => void;
};

/**
 * Displays a dialog for deleting a segment
 */
export default function DeleteSegment({
	abbreviation,
	name,
	open = false,
	otuId,
	schema,
	segmentName,
	setOpen = () => {},
}: DeleteSegmentProps) {
	const mutation = useUpdateOtu(otuId);

	function handleConfirm() {
		if (!segmentName) {
			return;
		}

		return mutation.mutateAsync({
			otuId,
			name,
			abbreviation,
			schema: schema.filter((s) => s.name !== segmentName),
		});
	}

	return (
		<DeleteDialog
			name={segmentName ?? ""}
			noun="Segment"
			onConfirm={handleConfirm}
			onOpenChange={setOpen}
			open={open}
		/>
	);
}
