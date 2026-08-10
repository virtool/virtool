import type { Account, Permission } from "@virtool/contracts";
import {
	AdministratorPermissions,
	hasSufficientAdminRole,
} from "@virtool/contracts";

/**
 * Check if a user has a sufficient admin role or legacy permissions to perform an action
 *
 * @param account - The Account object of the user
 * @param permission - The permissions to check
 * @returns  Whether the user is allowed to perform the action
 */
export function checkAdminRoleOrPermissionsFromAccount(
	account: Account,
	permission: Permission,
): boolean {
	return (
		hasSufficientAdminRole(
			AdministratorPermissions[permission],
			account.administratorRole,
		) || account.permissions[permission]
	);
}
