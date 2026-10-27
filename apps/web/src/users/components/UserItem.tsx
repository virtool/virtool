import { useCheckAdminRole } from "@administration/hooks";
import { InitialIcon, UserAvatar } from "@base/Icon";
import Label from "@base/Label";
import Link from "@base/Link";
import type { PaletteColor } from "@base/types";
import {
	getUserStatus,
	userRoleDisplayNames,
	userStatusDisplayNames,
} from "@users/utils";
import type { AdministeredUser, UserStatus } from "@virtool/contracts";
import { MailClock } from "lucide-react";

const statusColors: Record<UserStatus, PaletteColor> = {
	active: "green",
	invited: "orange",
	deactivated: "gray",
};

type UserItemProps = {
	user: AdministeredUser;
};

/**
 * One user in the table of users
 */
export function UserItem({ user }: UserItemProps) {
	const { hasPermission: canEdit } = useCheckAdminRole(
		user.administratorRole === null ? "users" : "full",
	);
	const isInvited = user.lifecycleState === "pending";
	const label = isInvited ? (
		<span className="text-gray-500 italic">No handle yet</span>
	) : (
		user.handle
	);
	const status = getUserStatus(user);

	return (
		<tr>
			<td>
				<span className="flex items-center gap-2 font-medium">
					{isInvited ? (
						<InitialIcon size="md" icon={MailClock} label="Invited user" />
					) : (
						<span aria-hidden className="flex">
							<UserAvatar size="md" handle={user.handle} />
						</span>
					)}
					{canEdit ? (
						<Link
							to="/administration/users/$userId"
							params={{ userId: String(user.id) }}
						>
							{label}
						</Link>
					) : (
						label
					)}
				</span>
			</td>
			<td className="text-gray-600">{user.email}</td>
			<td>
				{user.administratorRole ? (
					<Label color="purple">
						{userRoleDisplayNames[user.administratorRole]}
					</Label>
				) : (
					<span className="text-gray-500">{userRoleDisplayNames.none}</span>
				)}
			</td>
			<td>{user.primaryGroup && <Label>{user.primaryGroup.name}</Label>}</td>
			<td>
				<Label color={statusColors[status]}>
					{userStatusDisplayNames[status]}
				</Label>
			</td>
		</tr>
	);
}
