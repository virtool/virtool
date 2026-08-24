import { IconButton } from "@base/Icon";
import { useCurrentOtuContext } from "@otus/components/CurrentOtuContext";
import { useGetActiveIsolateId } from "@otus/hooks";
import { DownloadLink } from "@references/components/Detail/DownloadLink";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";
import { Pencil, Trash } from "lucide-react";

type SequenceButtonsProps = {
	id: string;
	onEdit: () => void;
	onDelete: () => void;
};

/**
 * A strip of actions for a sequence: edit, delete, and FASTA download
 */
export default function SequenceButtons({
	id,
	onEdit,
	onDelete,
}: SequenceButtonsProps) {
	const { otu, reference } = useCurrentOtuContext();

	const { hasPermission: canModify } = useCheckReferenceRight(
		reference.id,
		"modifyOtu",
	);
	const archived = useReferenceIsArchived(reference.id);
	const isolateId = useGetActiveIsolateId(otu);

	const href = `/otus/${otu.id}/isolates/${isolateId}/sequences/${id}/fasta`;

	return (
		<div className="flex items-center justify-end gap-1.5 px-2 py-1">
			{canModify && !archived && (
				<>
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
				</>
			)}
			<DownloadLink href={href} size="sm">
				FASTA
			</DownloadLink>
		</div>
	);
}
