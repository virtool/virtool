import { useFetchAccount } from "@account/account";
import { hasSufficientAdminRole } from "@administration/utils";
import { useFetchSample } from "./queries";

/**
 * Determines if the current user has permission to edit a sample
 *
 * @param sampleId - The unique identifier of the sample to check permissions for
 * @returns whether the current user has permission to edit the sample
 */
export function useCheckCanEditSample(sampleId: number) {
	const {
		data: account,
		isPending: isPendingAccount,
		isError: isErrorAccount,
	} = useFetchAccount();
	const {
		data: sample,
		isPending: isPendingSample,
		isError: isErrorSample,
	} = useFetchSample(sampleId);

	if ((isErrorAccount && !account) || (isErrorSample && !sample)) {
		return { hasPermission: false, isPending: false };
	}

	if (isPendingSample || isPendingAccount || !account || !sample) {
		return { hasPermission: false, isPending: true };
	}

	const hasPermission =
		hasSufficientAdminRole("full", account.administrator_role) ||
		sample.allWrite ||
		sample.user.id === account.id ||
		(sample.groupWrite &&
			account.groups.some((g) => g.id === sample.group?.id));

	return { hasPermission, isPending: false };
}
