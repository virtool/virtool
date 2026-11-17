import { useFetchAccount } from "@account/account";
import { useCheckAdminRole } from "@administration/hooks";
import Alert from "@base/Alert";
import { InitialIcon, UserAvatar } from "@base/Icon";
import Label from "@base/Label";
import SectionHeader from "@base/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import {
	invitationQueryOptions,
	useSuspenseUser,
	useUpdateUser,
} from "@users/queries";
import { checkCanResetTotp, checkCanRevokeAccess } from "@users/utils";
import { CircleAlert, MailClock, ShieldUserIcon } from "lucide-react";
import { DeletePendingUser } from "./DeletePendingUser";
import { InvitationControls } from "./InvitationControls";
import RecoveryLink from "./RecoveryLink";
import { ResetUserTotp } from "./ResetUserTotp";
import { RevokeUserAccess } from "./RevokeUserAccess";
import { UserActivationBanner } from "./UserActivationBanner";
import UserAdministratorRole from "./UserAdministratorRole";
import UserGroups from "./UserGroups";
import Username from "./Username";
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
	const { data: account } = useFetchAccount();
	const { hasPermission: canEdit } = useCheckAdminRole(
		data.administratorRole === null ? "users" : "full",
	);

	const isInvited = data.lifecycleState === "pending";
	const { data: invitation } = useQuery({
		...invitationQueryOptions(userId),
		enabled: isInvited && Boolean(canEdit),
	});

	const mutation = useUpdateUser();

	const canResetTotp = checkCanResetTotp(account, data);
	const canRevokeAccess = checkCanRevokeAccess(account, userId);

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

	const { administratorRole, id, groups, primaryGroup, permissions } = data;

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center justify-between gap-4">
					<h2 className="flex min-w-0 items-center gap-3">
						{isInvited ? (
							<>
								<InitialIcon size="xl" icon={MailClock} label="Invited user" />
								<span className="truncate">
									{invitation?.email ?? "Invited user"}
								</span>
							</>
						) : (
							<>
								<UserAvatar size="xl" username={data.username} />
								<span>{data.username}</span>
							</>
						)}
					</h2>
					{administratorRole && (
						<Label>
							<ShieldUserIcon aria-label="Administrator" size={18} />
							Administrator
						</Label>
					)}
				</div>
			</SectionHeader>

			{isInvited ? (
				<>
					<InvitationControls userId={id} />
					<UserAdministratorRole id={id} role={administratorRole} />
				</>
			) : (
				<>
					<UserAdministratorRole id={id} role={administratorRole} />
					<Username key={`username-${id}`} id={id} username={data.username} />
					<RecoveryLink userId={id} />
				</>
			)}

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

			<section>
				<SectionHeader level={3}>
					<h3>Danger Zone</h3>
				</SectionHeader>
				{isInvited ? (
					<DeletePendingUser userId={id} email={invitation?.email} />
				) : (
					<>
						{canResetTotp && (
							<ResetUserTotp userId={id} username={data.username} />
						)}
						{canRevokeAccess && (
							<RevokeUserAccess userId={id} username={data.username} />
						)}
						<UserActivationBanner
							onClick={() =>
								mutation.mutate({
									userId: id,
									update: { active: !data.active },
								})
							}
							verb={data.active ? "deactivate" : "activate"}
						/>
					</>
				)}
			</section>
		</div>
	);
}
