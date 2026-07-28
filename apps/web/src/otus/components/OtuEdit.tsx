import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { useUpdateOtu } from "@otus/queries";
import OtuForm from "./OtuForm";

type FormValues = {
	name: string;
	abbreviation: string;
};

type OtuEditProps = {
	abbreviation: string;
	name: string;
	open?: boolean;
	otuId: string;
	setOpen?: (open: boolean) => void;
};

/**
 * Displays a dialog for editing an OTU
 */
export default function OtuEdit({
	abbreviation,
	name,
	open = false,
	otuId,
	setOpen = () => {},
}: OtuEditProps) {
	const mutation = useUpdateOtu(otuId);

	function handleSubmit({ name, abbreviation }: FormValues) {
		mutation.mutate(
			{ otuId, name, abbreviation },
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
				<DialogTitle>Edit OTU</DialogTitle>
				<OtuForm
					name={name}
					abbreviation={abbreviation}
					error={mutation.error?.message}
					onSubmit={handleSubmit}
				/>
			</DialogContent>
		</Dialog>
	);
}
