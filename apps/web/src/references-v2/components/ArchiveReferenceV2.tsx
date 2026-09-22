import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@base/Dialog";
import { useSetReferenceV2Archived } from "@references-v2/queries";
import type { ReferenceV2 } from "@virtool/contracts";
import { useState } from "react";

/** Confirmation dialog for archiving or unarchiving a v2 Reference. */
export default function ArchiveReferenceV2({
	reference,
}: {
	reference: ReferenceV2;
}) {
	const [open, setOpen] = useState(false);
	const nextArchived = !reference.archived;
	const mutation = useSetReferenceV2Archived(reference.id, nextArchived);
	const verb = nextArchived ? "Archive" : "Unarchive";

	function handleConfirm() {
		mutation.mutate(undefined, {
			onSuccess: () => setOpen(false),
		});
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			mutation.reset();
		}
		setOpen(nextOpen);
	}

	return (
		<>
			<Button
				aria-label={`${verb} reference`}
				color="red"
				onClick={() => setOpen(true)}
			>
				{verb}
			</Button>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent>
					<DialogTitle>{verb} Reference</DialogTitle>
					<DialogDescription>
						{nextArchived
							? "Archiving makes this reference read-only. Existing analyses will continue to resolve."
							: "Unarchiving returns this reference to active use and allows it to be modified again."}
					</DialogDescription>
					{mutation.error && (
						<p className="text-sm text-red-700" role="alert">
							{mutation.error.message ||
								`Failed to ${verb.toLowerCase()} reference.`}
						</p>
					)}
					<DialogFooter className="gap-2">
						<Button
							disabled={mutation.isPending}
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							color={nextArchived ? "red" : "blue"}
							disabled={mutation.isPending}
							onClick={handleConfirm}
						>
							{verb}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
