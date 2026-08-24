import BoxGroupSection from "@base/BoxGroupSection";
import IconButton from "@base/IconButton";
import InitialIcon from "@base/InitialIcon";
import { Pencil, Trash } from "lucide-react";

type MemberItemIconProps = {
	handle: string;
};

function MemberItemIcon({ handle }: MemberItemIconProps) {
	return (
		<div className="flex items-center pr-2">
			<InitialIcon handle={handle} size="lg" />
		</div>
	);
}

export type MemberItemProps = {
	/** Whether the current user can modify members in the list */
	canModify: boolean;

	/** The unique identifier for the member */
	id: number;

	/** The handle (user) or name of the member user or group */
	handleOrName: string;

	/** Callback to initiate editing the member */
	onEdit: (id: number) => void;

	/** Callback to initiate removing the member */
	onRemove: (id: number) => void;
};

/**
 * A condensed user or group item for display in the reference members list
 */
export default function MemberItem({
	canModify,
	handleOrName,
	id,
	onEdit,
	onRemove,
}: MemberItemProps) {
	return (
		<BoxGroupSection className="flex items-center">
			<MemberItemIcon handle={handleOrName} />
			{handleOrName}
			{canModify && (
				<span className="flex items-center gap-1 ml-auto">
					<IconButton
						IconComponent={Pencil}
						color="gray"
						tip="edit member"
						onClick={() => onEdit(id)}
					/>
					<IconButton
						IconComponent={Trash}
						color="red"
						tip="Remove member"
						onClick={() => onRemove(id)}
					/>
				</span>
			)}
		</BoxGroupSection>
	);
}
