import { BoxGroupSection } from "@base/Box";
import { IconButton, InitialIcon } from "@base/Icon";
import { Pencil, Trash } from "lucide-react";

type MemberItemIconProps = {
	username: string;
};

function MemberItemIcon({ username }: MemberItemIconProps) {
	return (
		<div className="flex items-center pr-2">
			<InitialIcon username={username} size="lg" />
		</div>
	);
}

export type MemberItemProps = {
	/** Whether the current user can modify members in the list */
	canModify: boolean;

	/** The unique identifier for the member */
	id: number;

	/** The username (user) or name of the member user or group */
	usernameOrName: string;

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
	usernameOrName,
	id,
	onEdit,
	onRemove,
}: MemberItemProps) {
	return (
		<BoxGroupSection className="flex items-center">
			<MemberItemIcon username={usernameOrName} />
			{usernameOrName}
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
