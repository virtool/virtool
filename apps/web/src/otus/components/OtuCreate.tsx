import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { useCreateOtu } from "../queries";
import OtuForm from "./OtuForm";

type FormValues = {
	name: string;
	abbreviation: string;
};

type CreateOtuProps = {
	open: boolean;
	refId: number;
	setOpen: (open: boolean) => void;
};

/**
 * Displays a dialog to create an OTU
 */
export default function OtuCreate({ open, refId, setOpen }: CreateOtuProps) {
	const mutation = useCreateOtu(refId);

	function handleSubmit({ name, abbreviation }: FormValues) {
		mutation.mutate(
			{ name, abbreviation },
			{
				onSuccess: () => {
					setOpen(false);
				},
			},
		);
	}

	function onHide() {
		setOpen(false);
		mutation.reset();
	}

	return (
		<Dialog open={open} onOpenChange={onHide}>
			<DialogContent>
				<DialogTitle>Create OTU</DialogTitle>
				<OtuForm onSubmit={handleSubmit} error={mutation.error?.message} />
			</DialogContent>
		</Dialog>
	);
}
