import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { useUpdateOtu } from "@otus/queries";
import OtuForm from "./OtuForm";

type FormValues = {
	name: string;
	acronym: string;
};

type OtuEditProps = {
	acronym: string;
	name: string;
	open?: boolean;
	otuId: string;
	setOpen?: (open: boolean) => void;
};

/**
 * Displays a dialog for editing an OTU
 */
export default function OtuEdit({
	acronym,
	name,
	open = false,
	otuId,
	setOpen = () => {},
}: OtuEditProps) {
	const mutation = useUpdateOtu(otuId);

	function handleSubmit({ name, acronym }: FormValues) {
		mutation.mutate(
			{ otuId, name, acronym },
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
					acronym={acronym}
					error={mutation.error?.message}
					onSubmit={handleSubmit}
				/>
			</DialogContent>
		</Dialog>
	);
}
