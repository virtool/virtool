import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import CreateReferenceV2Form from "./CreateReferenceV2Form";

type CreateReferenceV2Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** A dialog for creating a local v2 Reference. */
export default function CreateReferenceV2({
	open,
	onOpenChange,
}: CreateReferenceV2Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="lg">
				<DialogTitle>Create Reference</DialogTitle>
				<CreateReferenceV2Form onSuccess={() => onOpenChange(false)} />
			</DialogContent>
		</Dialog>
	);
}
