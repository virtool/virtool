import type { Permission } from "./permissions";

/**
 * The names of every administrator role, ordered from most to least privileged.
 *
 * The four values are the ones the `administrator_role_valid` CHECK constraint
 * on `users.administrator_role` permits.
 */
export const ADMINISTRATOR_ROLE_NAMES = [
	"full",
	"settings",
	"users",
	"base",
] as const;

/** A role that grants a user administrative access to the instance. */
export type AdministratorRoleName = (typeof ADMINISTRATOR_ROLE_NAMES)[number];

/** A selectable administrator role with its human-readable name and description. */
export type AdministratorRole = {
	id: AdministratorRoleName;
	name: string;
	description: string;
};

/** Every administrator role, ordered from most to least privileged. */
export const ADMINISTRATOR_ROLES: AdministratorRole[] = [
	{
		id: "full",
		name: "Full",
		description: "Manage who is an administrator and what they can do.",
	},
	{
		id: "settings",
		name: "Settings",
		description: "Manage instance settings.",
	},
	{
		id: "users",
		name: "Users",
		description: "Create user accounts. Control activation of user accounts.",
	},
	{
		id: "base",
		name: "Base",
		description: "Manage HMMs and common references. View and cancel any job.",
	},
];

/**
 * The permissions level of each administrator role.
 *
 * A strict ranking, `full` strongest through `base` weakest, so requiring
 * `base` means "any administrator".
 */
const AdministratorPermissionsLevel: Record<AdministratorRoleName, number> = {
	full: 0,
	settings: 1,
	users: 2,
	base: 3,
};

/**
 * Check if a user has a sufficient admin role
 *
 * @param requiredRole - The lowest admin role the user must have to pass the check
 * @param userRole - The administrator role of the user
 */
export function hasSufficientAdminRole(
	requiredRole: AdministratorRoleName,
	userRole: AdministratorRoleName | null,
): boolean {
	if (userRole === null) {
		return false;
	}

	return (
		AdministratorPermissionsLevel[userRole] <=
		AdministratorPermissionsLevel[requiredRole]
	);
}

/**
 * Permissions granted to each administrator role
 */
export const AdministratorPermissions: Record<
	Permission,
	AdministratorRoleName
> = {
	cancel_job: "base",
	create_ref: "base",
	modify_hmm: "base",
	remove_job: "base",
	upload_file: "full",
	create_sample: "full",
	modify_subtraction: "full",
	remove_file: "full",
};
