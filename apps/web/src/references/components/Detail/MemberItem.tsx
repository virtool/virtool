import { BoxGroupSection } from "@base/Box";
import { IconButton, InitialIcon } from "@base/Icon";
import { MailClock, Pencil, Trash } from "lucide-react";

type MemberItemIconProps = {
	name: string | null;
};

function MemberItemIcon({ name }: MemberItemIconProps) {
	return (
		<div className="flex items-center pr-2">
			{name === null ? (
				<InitialIcon size="lg" icon={MailClock} label="Invited user" />
			) : (
				<InitialIcon name={name} size="lg" />
			)}
		</div>
	);
}

export type MemberItemProps = {
	/** Whether the current user can modify members in the list */
	canModify: boolean;

	/** The unique identifier for the member */
	id: number;

	/** The username of a member user or the name of a member group, or null for an invited user */
	name: string | null;

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
	name,
	id,
	onEdit,
	onRemove,
}: MemberItemProps) {
	return (
		<BoxGroupSection className="flex items-center">
			<MemberItemIcon name={name} />
			{name ?? <span className="text-gray-500 italic">No username yet</span>}
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
