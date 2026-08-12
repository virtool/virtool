import type { Permission } from "./permissions";

/**
 * All administrator roles, ordered from most to least privileged.
 *
 * The five values are the Postgres `administratorrole` enum's. `spaces` is
 * obsolete in product terms but stays a valid value because Python still writes
 * it; dropping it needs a Python-side migration first.
 */
export type AdministratorRoleName =
	| "full"
	| "settings"
	| "spaces"
	| "users"
	| "base";

/**
 * The permissions level of each administrator role.
 *
 * A strict ranking, `full` strongest through `base` weakest, so requiring
 * `base` means "any administrator". Python's
 * `virtool/users/data.py::check_administrator_role` is not a total order — it
 * scores `base` = 1, `users` / `settings` / `spaces` as level-2 **peers**, and
 * `full` = 3 — so a `users` administrator clears a `settings` requirement there
 * and not here. Every requirement declared in this repo is `base`, `users`,
 * `settings` or `full`, and only the `settings` ones sit where the two differ.
 */
const AdministratorPermissionsLevel: Record<AdministratorRoleName, number> = {
	full: 0,
	settings: 1,
	spaces: 2,
	users: 3,
	base: 4,
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
