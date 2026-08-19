import BoxGroupSection from "@base/BoxGroupSection";
import Button from "@base/Button";
import Icon from "@base/Icon";
import { Trash } from "lucide-react";

type UploadListHeaderProps = {
	/** Whether the files can be deleted, which the Delete action requires */
	canDelete: boolean;

	/** The number of files of this type */
	found: number;

	/** Callback to delete every selected file */
	onDelete: () => void;

	/** The number of selected files, which the actions apply to */
	selectedCount: number;
};

/**
 * The bar above the file table. Shows the file count until files are selected,
 * then swaps in the actions that apply to the selection.
 */
export default function UploadListHeader({
	canDelete,
	found,
	onDelete,
	selectedCount,
}: UploadListHeaderProps) {
	return (
		<BoxGroupSection className="flex items-center gap-4 h-14 py-0 text-sm font-medium text-gray-600">
			<span>
				{selectedCount
					? `${selectedCount} selected`
					: `${found} ${found === 1 ? "file" : "files"}`}
			</span>
			{selectedCount > 0 && (
				<div className="ml-auto flex items-center gap-2">
					{canDelete && (
						<Button color="red" size="small" onClick={onDelete}>
							<Icon icon={Trash} /> Delete
						</Button>
					)}
				</div>
			)}
		</BoxGroupSection>
	);
}
