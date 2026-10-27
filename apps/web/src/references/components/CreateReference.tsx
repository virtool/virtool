import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@base/Field";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";
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
				<FieldSet>
					<FieldLegend variant="label">Method</FieldLegend>
					<RadioGroup
						className="grid-cols-2"
						onValueChange={(value) => setMode(value as "empty" | "import")}
						value={mode}
					>
						<FieldLabel variant="card">
							<Field orientation="horizontal" className="items-start">
								<RadioGroupItem className="mt-0.5" value="empty" />
								<FieldContent>
									<FieldTitle>Empty</FieldTitle>
									<FieldDescription>
										Start from a blank reference.
									</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
						<FieldLabel variant="card">
							<Field orientation="horizontal" className="items-start">
								<RadioGroupItem className="mt-0.5" value="import" />
								<FieldContent>
									<FieldTitle>Import</FieldTitle>
									<FieldDescription>
										Create a reference from a file previously exported from
										another Virtool reference.
									</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
					</RadioGroup>
				</FieldSet>
				<CreateReferenceForm mode={mode} onSuccess={handleSuccess} />
			</DialogContent>
		</Dialog>
	);
}
