import { useFetchAccount } from "@account/account";
import type { ReferenceRight } from "@virtool/contracts";
import { useFetchReference } from "./queries";

/**
 * Returns whether the reference is archived. `false` while the reference query is loading.
 */
export function useReferenceIsArchived(referenceId: number) {
	const { data: reference } = useFetchReference(referenceId);
	return reference?.archived ?? false;
}

/**
 * Check if the logged in account has the passed `right` on the reference detail is loaded for.
 *
 * @param referenceId - The id of the reference to check
 * @param right - The right to check for (eg. modifyOtu)
 * @returns Whether the right is possessed by the account
 */
export function useCheckReferenceRight(
	referenceId: number,
	right: ReferenceRight,
) {
	const { data: account, isPending: isPendingAccount } = useFetchAccount();
	const { data: reference, isPending: isPendingReference } =
		useFetchReference(referenceId);

	if (isPendingAccount || isPendingReference) {
		return { hasPermission: false, isPending: true };
	}

	if (!account || !reference) {
		return { hasPermission: false, isPending: false };
	}

	if (account.administratorRole === "full") {
		return { hasPermission: true, isPending: false };
	}

	const user = reference.users.find((u) => u.id === account.id);

	if (user?.[right]) {
		return { hasPermission: true, isPending: false };
	}

	// Groups in common between the user and the reference member groups.
	const groups = reference.groups.filter((referenceGroup) =>
		account.groups.some(
			(accountGroup) => accountGroup.id === referenceGroup.id,
		),
	);

	return {
		hasPermission: groups?.some((g) => g[right] === true),
		isPending: false,
	};
}
