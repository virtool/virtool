import { useFetchAccount } from "@account/account";
import { useFetchSample } from "./queries";
import { checkCanEditSample } from "./utils";

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

	const hasPermission = checkCanEditSample(account, sample);

	return { hasPermission, isPending: false };
}
