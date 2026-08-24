import DeleteDialog from "@base/DeleteDialog";
import IconButton from "@base/IconButton";
import { useDeleteSample } from "@samples/queries";
import { checkCanDeleteSample } from "@samples/utils";
import type { JobNested } from "@virtool/contracts";
import { Trash } from "lucide-react";

type DeleteSampleProps = {
	/** The id of the sample being deleted */
	id: number;

	/** The sample's job if it exists */
	job?: JobNested;

	/** The name of the sample being deleted */
	name: string;

	/** Whether the sample is ready */
	ready: boolean;
};

/**
 * Displays a dialog for deleting a sample
 */
export default function DeleteSample({
	id,
	job,
	name,
	ready,
}: DeleteSampleProps) {
	const mutation = useDeleteSample();

	if (!checkCanDeleteSample(ready, job)) {
		return null;
	}

	return (
		<DeleteDialog
			name={name}
			noun="Sample"
			onConfirm={() => mutation.mutateAsync({ sampleId: id })}
			trigger={<IconButton color="red" IconComponent={Trash} tip="Delete" />}
		/>
	);
}
