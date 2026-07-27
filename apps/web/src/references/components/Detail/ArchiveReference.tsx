import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@base/Dialog";
import IconButton from "@base/IconButton";
import {
	useArchiveReference,
	useUnarchiveReference,
} from "@references/queries";
import type { Reference } from "@virtool/contracts";
import { AlertCircle, Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";

type ArchiveReferenceProps = {
	detail: Reference;
};

/**
 * An archive/unarchive icon button and the dialog confirming the action
 */
export default function ArchiveReference({ detail }: ArchiveReferenceProps) {
	const [open, setOpen] = useState(false);
	const archiveMutation = useArchiveReference(detail.id);
	const unarchiveMutation = useUnarchiveReference(detail.id);

	const mutation = detail.archived ? unarchiveMutation : archiveMutation;
	const verb = detail.archived ? "Unarchive" : "Archive";

	function handleConfirm() {
		mutation.mutate(undefined, {
			onSuccess: () => setOpen(false),
		});
	}

	function handleOpenChange(next: boolean) {
		if (!next) {
			mutation.reset();
			setOpen(false);
		}
	}

	let errorMessage: string | null = null;
	if (mutation.error) {
		errorMessage =
			mutation.error.message ||
			`Failed to ${verb.toLowerCase()} reference. Please try again.`;
	}

	const Icon = detail.archived ? ArchiveRestore : Archive;

	return (
		<>
			<IconButton
				color="gray"
				IconComponent={Icon}
				tip={detail.archived ? "unarchive" : "archive"}
				onClick={() => setOpen(true)}
			/>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent>
					<div className="flex gap-4">
						<div className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-gray-100 text-gray-600">
							<Icon size={20} strokeWidth={2.25} />
						</div>
						<div className="min-w-0 flex-1">
							<DialogTitle>
								{verb} <span className="text-gray-700">{detail.name}</span>?
							</DialogTitle>
							<DialogDescription>
								{detail.archived
									? "It will return to active use and appear in the default references list."
									: "Archived references are hidden from default views and blocked from edits and new analyses. Existing analyses will continue to resolve."}
							</DialogDescription>
						</div>
					</div>

					{errorMessage && (
						<div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded border border-red-200 bg-red-50 text-red-700">
							<AlertCircle size={16} className="mt-0.5 shrink-0" />
							<div className="text-sm leading-snug">
								<span className="font-semibold">
									Cannot {verb.toLowerCase()}.
								</span>{" "}
								{errorMessage}
							</div>
						</div>
					)}

					<DialogFooter className="mt-2 gap-2">
						<Button onClick={() => handleOpenChange(false)}>Cancel</Button>
						<Button color="blue" onClick={handleConfirm}>
							{verb}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
