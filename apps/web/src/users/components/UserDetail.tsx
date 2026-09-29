import { useFetchAccount } from "@account/account";
import { useCheckAdminRole } from "@administration/hooks";
import Alert from "@base/Alert";
import { InitialIcon } from "@base/Icon";
import Label from "@base/Label";
import SectionHeader from "@base/SectionHeader";
import { useQuery } from "@tanstack/react-query";
import {
	invitationQueryOptions,
	useSuspenseUser,
	useUpdateUser,
} from "@users/queries";
import { hasSufficientAdminRole } from "@virtool/contracts";
import { CircleAlert, MailClock, ShieldUserIcon } from "lucide-react";
import { DeletePendingUser } from "./DeletePendingUser";
import Handle from "./Handle";
import { InvitationControls } from "./InvitationControls";
import Password from "./Password";
import { ResetUserTotp } from "./ResetUserTotp";
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

	const canResetTotp =
		data.twoFactorEnabled &&
		account !== undefined &&
		account.id !== userId &&
		hasSufficientAdminRole("full", account.administratorRole);

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
								<InitialIcon size="xl" handle={handle} />
								<span>{handle}</span>
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
					<Handle key={`handle-${id}`} id={id} handle={handle} />
					<Password
						key={id}
						id={id}
						lastPasswordChange={lastPasswordChange}
						forceReset={forceReset}
					/>
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
						{canResetTotp && <ResetUserTotp userId={id} handle={handle} />}
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
