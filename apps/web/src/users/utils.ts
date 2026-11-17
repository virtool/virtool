import {
	type Account,
	type AdministeredUser,
	hasSufficientAdminRole,
	type UserRoleFilter,
	type UserStatus,
} from "@virtool/contracts";

/** The display name of each account state. */
export const userStatusDisplayNames: Record<UserStatus, string> = {
	active: "Active",
	invited: "Invited",
	deactivated: "Deactivated",
};

/** The display name of each role filter. */
export const userRoleDisplayNames: Record<UserRoleFilter, string> = {
	full: "Full",
	settings: "Settings",
	users: "Users",
	base: "Base",
	none: "None",
};

/** Get the account state the user administration list shows for a user. */
export function getUserStatus(
	user: Pick<AdministeredUser, "active" | "lifecycleState">,
): UserStatus {
	if (!user.active) {
		return "deactivated";
	}

	return user.lifecycleState === "pending" ? "invited" : "active";
}

/** Build the account setup link for a newly issued invitation token. */
export function getAccountSetupUrl(token: string): string {
	return `${window.location.origin}/account-setup#token=${token}`;
}

/**
 * Whether the account can reset a user's TOTP: only a full administrator, only
 * for another user, and only once that user has enrolled.
 */
export function checkCanResetTotp(
	account: Pick<Account, "administratorRole" | "id"> | undefined,
	user: { id: number; twoFactorEnabled: boolean },
): boolean {
	return (
		user.twoFactorEnabled &&
		account !== undefined &&
		account.id !== user.id &&
		hasSufficientAdminRole("full", account.administratorRole)
	);
}

/** Whether the account can revoke a user's access, which it cannot do to itself. */
export function checkCanRevokeAccess(
	account: Pick<Account, "id"> | undefined,
	userId: number,
): boolean {
	return account !== undefined && account.id !== userId;
}

/**
 * The groups left once a user leaves one, and whether that clears the
 * primary group.
 */
export function getGroupRemoval(
	memberIds: number[],
	primaryGroupId: number | null,
	groupId: number,
): { groups: number[]; clearsPrimary: boolean } {
	return {
		groups: memberIds.filter((memberId) => memberId !== groupId),
		clearsPrimary: primaryGroupId === groupId,
	};
}
