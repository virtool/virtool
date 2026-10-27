import { IconButton } from "@base/Icon";
import { useCurrentOtuContext } from "@otus/components/CurrentOtuContext";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";
import { Pencil, Trash } from "lucide-react";

type SequenceButtonsProps = {
	onEdit: () => void;
	onDelete: () => void;
};

/**
 * A strip of actions for a sequence: edit and delete
 */
export default function SequenceButtons({
	onEdit,
	onDelete,
}: SequenceButtonsProps) {
	const { reference } = useCurrentOtuContext();

	const { hasPermission: canModify } = useCheckReferenceRight(
		reference.id,
		"modifyOtu",
	);
	const archived = useReferenceIsArchived(reference.id);

	if (!canModify || archived) {
		return null;
	}

	return (
		<div className="flex items-center justify-end gap-1.5 px-2 py-1">
			<IconButton
				IconComponent={Pencil}
				color="gray"
				size={14}
				tip="Edit"
				onClick={onEdit}
			/>
			<IconButton
				IconComponent={Trash}
				color="red"
				size={14}
				tip="Delete"
				onClick={onDelete}
			/>
		</div>
	);
}
