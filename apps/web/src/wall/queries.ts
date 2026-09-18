import { accountQueryKeys } from "@account/keys";
import {
	completeEmailRemediationFn,
	createFirstUserFn,
	getEmailRemediationFn,
	loginFn,
	logoutFn,
	resetPasswordFn,
	submitEmailRemediationFn,
	verifyTwoFactorFn,
} from "@server/auth/functions";
import {
	queryOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { rootQueryKeys } from "@wall/keys";

/** Result of a login attempt. */
export type LoginResult = Awaited<ReturnType<typeof loginFn>>;

/** Result of a successful password reset. */
export type ResetPasswordResult = {
	login: false;
	remediation: boolean;
	reset: false;
};

/** Query options for resumable restricted email-remediation state. */
export function emailRemediationQueryOptions() {
	return queryOptions({
		queryKey: ["email-remediation"],
		queryFn: () => getEmailRemediationFn(),
	});
}

/**
 * Initializes a mutator for creating the first instance user.
 *
 * The new user is authenticated by the server function, so on success the
 * cached root and account documents are dropped. That forces the authenticated
 * route guard to refetch them instead of reusing the pre-setup snapshot, which
 * would otherwise redirect straight back to `/setup`.
 *
 * @returns A mutator for creating the first instance user.
 */
export function useCreateFirstUser() {
	const queryClient = useQueryClient();

	return useMutation<
		Awaited<ReturnType<typeof createFirstUserFn>>,
		Error,
		{ handle: string; password: string }
	>({
		mutationFn: ({ handle, password }) =>
			createFirstUserFn({ data: { handle, password } }),
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
			queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}

/**
 * Initializes a mutator for sending a login request to the API.
 *
 * @returns A mutator for sending a login request to the API.
 */
export function useLoginMutation() {
	const queryClient = useQueryClient();

	return useMutation<LoginResult, Error, { handle: string; password: string }>({
		mutationFn: ({ handle, password }) =>
			loginFn({ data: { handle, password } }),
		onSuccess: (data) => {
			if (!("twoFactorRedirect" in data) && !data.reset) {
				queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
			}
		},
	});
}

/**
 * Initializes a mutator for sending a password reset request to the API.
 *
 * @returns A mutator for sending a password reset request to the API.
 */
export function useResetPasswordMutation() {
	const queryClient = useQueryClient();

	return useMutation<ResetPasswordResult, Error, { password: string }>({
		mutationFn: ({ password }) => resetPasswordFn({ data: { password } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}

/** Verify a second factor before refreshing authenticated account data. */
export function useVerifyTwoFactorMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: { code: string; recovery: boolean }) =>
			verifyTwoFactorFn({ data }),
		onSuccess: (data) => {
			if (!data.reset) {
				queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
			}
		},
	});
}

/** Submit an address for online verification or offline completion. */
export function useSubmitEmailRemediation() {
	return useMutation({
		mutationFn: (email: string) =>
			submitEmailRemediationFn({ data: { email } }),
	});
}

/** Complete remediation with the one-time mailbox token. */
export function completeEmailRemediation(token: string) {
	return completeEmailRemediationFn({ data: { token } });
}

/** Abandon the restricted flow and clear every browser credential. */
export function useCancelEmailRemediation() {
	return useMutation({ mutationFn: () => logoutFn() });
}
