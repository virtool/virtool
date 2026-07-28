import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { useCreateIsolate } from "@otus/queries";
import IsolateForm from "./IsolateForm";

type FormValues = {
	sourceName: string;
	sourceType: string;
};

type CreateIsolateProps = {
	allowedSourceTypes: string[];
	/** A callback function to hide the dialog */
	onHide: () => void;
	otuId: string;
	/** Indicates whether the source types are restricted */
	restrictSourceTypes: boolean;
	/** Indicates whether the dialog to add an OTU is visible */
	show: boolean;
};

/**
 * Displays dialog to create an OTU isolate
 */
export default function CreateIsolate({
	allowedSourceTypes,
	onHide,
	otuId,
	restrictSourceTypes,
	show,
}: CreateIsolateProps) {
	const mutation = useCreateIsolate(otuId);

	function handleSubmit({ sourceName, sourceType }: FormValues) {
		mutation.mutate(
			{ otuId, sourceType: sourceType || "unknown", sourceName },
			{
				onSuccess: () => {
					onHide();
				},
			},
		);
	}

	return (
		<Dialog open={show} onOpenChange={onHide}>
			<DialogContent>
				<DialogTitle>Create Isolate</DialogTitle>
				<IsolateForm
					allowedSourceTypes={allowedSourceTypes}
					restrictSourceTypes={restrictSourceTypes}
					onSubmit={handleSubmit}
				/>
			</DialogContent>
		</Dialog>
	);
}
