import { useFetchAccount } from "@account/account";
import type { ReferenceV2Right } from "@virtool/contracts";
import { useSuspenseReferenceV2 } from "./queries";

/** Check whether the signed-in account holds a right on a v2 Reference. */
export function useCheckReferenceV2Right(
	referenceId: string,
	right: ReferenceV2Right,
): boolean {
	const { data: account } = useFetchAccount();
	const { data: reference } = useSuspenseReferenceV2(referenceId);

	if (!account) {
		return false;
	}
	if (account.administratorRole === "full") {
		return true;
	}
	if (reference.users.some((user) => user.id === account.id && user[right])) {
		return true;
	}
	return reference.groups.some(
		(group) =>
			group[right] &&
			account.groups.some((accountGroup) => accountGroup.id === group.id),
	);
}
