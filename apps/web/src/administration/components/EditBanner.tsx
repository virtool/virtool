import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { IconButton } from "@base/Icon";
import type { BannerColor } from "@virtool/contracts";
import { Pen } from "lucide-react";
import { useState } from "react";
import BannerForm, { type BannerFormValues } from "./BannerForm";

type EditBannerProps = {
	color: BannerColor;
	message: string;
	/** Resolves on success so the dialog can close; rejects to surface the error. */
	onSubmit: (values: BannerFormValues) => Promise<unknown>;
};

/**
 * Dialog for editing an existing banner. Pure presentation — submission is
 * delegated to `onSubmit`.
 */
export default function EditBanner({
	color,
	message,
	onSubmit,
}: EditBannerProps) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | undefined>();

	async function handleSubmit(values: BannerFormValues) {
		setError(undefined);
		try {
			await onSubmit(values);
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not update banner.");
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
			<IconButton
				IconComponent={Pen}
				onClick={() => setOpen(true)}
				tip="Edit"
			/>
			<DialogContent>
				<DialogTitle>Edit Banner</DialogTitle>
				<BannerForm
					color={color}
					error={error}
					message={message}
					onSubmit={handleSubmit}
				/>
			</DialogContent>
		</Dialog>
	);
}
