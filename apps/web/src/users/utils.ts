import type {
	AdministeredUser,
	UserRoleFilter,
	UserStatus,
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
