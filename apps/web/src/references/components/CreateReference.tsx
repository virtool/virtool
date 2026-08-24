import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { SelectBox, SelectBoxItem } from "@base/Select";
import { useState } from "react";
import { CreateReferenceForm } from "./CreateReferenceForm";

type CreateReferenceProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * The create reference view with options to create an empty reference or import a reference
 */
export function CreateReference({ open, onOpenChange }: CreateReferenceProps) {
	const [mode, setMode] = useState<"empty" | "import">("empty");

	function handleOpenChange(open: boolean) {
		onOpenChange(open);
		if (!open) {
			setMode("empty");
		}
	}

	function handleSuccess() {
		onOpenChange(false);
		setMode("empty");
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent size="lg">
				<DialogTitle>Create Reference</DialogTitle>
				<div className="mb-4">
					<SelectBox
						className="grid-cols-2"
						label="Method"
						onValueChange={(value) => setMode(value as "empty" | "import")}
						value={mode}
					>
						<SelectBoxItem value="empty">
							<div>Empty</div>
							<span>Start from a blank reference.</span>
						</SelectBoxItem>
						<SelectBoxItem value="import">
							<div>Import</div>
							<span>
								Create a reference from a file previously exported from another
								Virtool reference.
							</span>
						</SelectBoxItem>
					</SelectBox>
				</div>
				<CreateReferenceForm mode={mode} onSuccess={handleSuccess} />
			</DialogContent>
		</Dialog>
	);
}
