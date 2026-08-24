import IconButton from "@base/IconButton";
import { useCheckReferenceRight } from "@references/hooks";
import { Pencil, Trash } from "lucide-react";
import { useState } from "react";
import OtuDelete from "../OtuDelete";
import OtuEdit from "../OtuEdit";

type OtuHeaderIconsProps = {
	id: string;
	name: string;
	referenceId: number;
	abbreviation: string;
	onDeleted: () => void;
};

/**
 * Displays end icons to edit or delete an OTU
 */
export function OtuHeaderIcons({
	id,
	name,
	referenceId,
	abbreviation,
	onDeleted,
}: OtuHeaderIconsProps) {
	const [openEdit, setOpenEdit] = useState(false);
	const [openDelete, setOpenDelete] = useState(false);
	const { hasPermission: canModify } = useCheckReferenceRight(
		referenceId,
		"modifyOtu",
	);

	if (!canModify) {
		return null;
	}

	return (
		<>
			<IconButton
				key="edit-icon"
				color="gray"
				IconComponent={Pencil}
				tip="edit OTU"
				onClick={() => setOpenEdit(true)}
			/>
			<IconButton
				key="delete-icon"
				ariaLabel="Delete OTU"
				color="red"
				IconComponent={Trash}
				tip="Delete"
				onClick={() => setOpenDelete(true)}
			/>

			<OtuEdit
				otuId={id}
				name={name}
				abbreviation={abbreviation}
				open={openEdit}
				setOpen={setOpenEdit}
			/>
			<OtuDelete
				id={id}
				name={name}
				open={openDelete}
				setOpen={setOpenDelete}
				onDeleted={onDeleted}
			/>
		</>
	);
}
