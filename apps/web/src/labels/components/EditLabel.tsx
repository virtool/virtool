import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { IconButton } from "@base/Icon";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { LabelForm } from "./LabelForm";

/** Fields collected by the edit-label form. */
export type UpdatedLabel = {
	color: string;
	description: string;
	name: string;
};

type EditLabelProps = {
	color: string;
	description: string;
	name: string;
	/** Resolves on success so the dialog can close; rejects to surface the error. */
	onSubmit: (values: UpdatedLabel) => Promise<unknown>;
};

/**
 * Dialog for editing a label. Pure presentation — submission is delegated
 * to `onSubmit`; rejection messages are displayed inline.
 */
export function EditLabel({
	color,
	description,
	name,
	onSubmit,
}: EditLabelProps) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | undefined>();

	async function handleSubmit(values: UpdatedLabel) {
		setError(undefined);
		try {
			await onSubmit(values);
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not update label.");
		}
	}

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (!next) {
			setError(undefined);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<IconButton IconComponent={Pencil} color="gray" tip="edit label" />
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Edit a label</DialogTitle>
				<LabelForm
					color={color}
					description={description}
					error={error}
					name={name}
					onSubmit={handleSubmit}
				/>
			</DialogContent>
		</Dialog>
	);
}
