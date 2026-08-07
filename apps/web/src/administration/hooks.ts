import { useFetchAccount } from "@account/account";
import {
	type AdministratorRoleName,
	hasSufficientAdminRole,
	type Permission,
} from "@virtool/contracts";
import { checkAdminRoleOrPermissionsFromAccount } from "./utils";

export type PermissionQueryResult = {
	hasPermission: boolean | null;
	isError: boolean;
	isPending: boolean;
};

/**
 * Check the logged-in user has sufficient admin role
 *
 * @param requiredRole - The required role to check against.
 * @returns Whether the user has the required role.
 */
export function useCheckAdminRole(
	requiredRole: AdministratorRoleName,
): PermissionQueryResult {
	const { data: account, isError, isPending } = useFetchAccount();
	return {
		hasPermission: account
			? hasSufficientAdminRole(requiredRole, account.administratorRole)
			: null,
		isError,
		isPending,
	};
}

export function useCheckAdminRoleOrPermission(
	permission: Permission,
): PermissionQueryResult {
	const { data: account, isError, isPending } = useFetchAccount();
	return {
		hasPermission: account
			? checkAdminRoleOrPermissionsFromAccount(account, permission)
			: null,
		isError,
		isPending,
	};
}
