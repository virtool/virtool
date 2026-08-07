import { useCheckAdminRole } from "@administration/hooks";
import Alert from "@base/Alert";
import InitialIcon from "@base/InitialIcon";
import Label from "@base/Label";
import { useSuspenseUser, useUpdateUser } from "@users/queries";
import { CircleAlert, ShieldUserIcon } from "lucide-react";
import Handle from "./Handle";
import Password from "./Password";
import { UserActivationBanner } from "./UserActivationBanner";
import UserAdministratorRole from "./UserAdministratorRole";
import UserGroups from "./UserGroups";
import UserPermissions from "./UserPermissions";

type UserDetailProps = {
	/** The unique id of the user being viewed */
	userId: number;
};

/**
 * The detailed view of a user
 */
export default function UserDetail({ userId }: UserDetailProps) {
	const { data } = useSuspenseUser(userId);
	const { hasPermission: canEdit } = useCheckAdminRole(
		data.administratorRole === null ? "users" : "full",
	);

	const mutation = useUpdateUser();

	if (!canEdit) {
		return (
			<Alert color="orange" level>
				<CircleAlert />
				<span>
					<strong>You do not have permission to manage this user.</strong>
					<span> Contact an administrator.</span>
				</span>
			</Alert>
		);
	}

	const {
		handle,
		administratorRole,
		id,
		groups,
		primaryGroup,
		permissions,
		lastPasswordChange,
		forceReset,
	} = data;

	return (
		<div>
			<header className="flex items-center justify-between mb-5">
				<h2 className="flex items-center text-2xl gap-3">
					<InitialIcon size="xl" handle={handle} />
					<span>{handle}</span>
				</h2>
				{administratorRole && (
					<Label>
						<ShieldUserIcon aria-label="Administrator" size={18} />
						Administrator
					</Label>
				)}
			</header>

			<UserAdministratorRole id={id} role={administratorRole} />

			<Handle key={`handle-${id}`} id={id} handle={handle} />

			<Password
				key={id}
				id={id}
				lastPasswordChange={lastPasswordChange}
				forceReset={forceReset}
			/>

			<div className="mb-4 md:grid md:grid-cols-2 md:gap-x-4">
				<div>
					<UserGroups
						userId={id}
						memberGroups={groups}
						primaryGroup={primaryGroup}
					/>
				</div>
				<UserPermissions permissions={permissions} />
			</div>

			<UserActivationBanner
				onClick={() =>
					mutation.mutate({
						userId: id,
						update: { active: !data.active },
					})
				}
				verb={data.active ? "deactivate" : "activate"}
			/>
		</div>
	);
}
