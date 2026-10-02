import { accountQueryKeys } from "@account/keys";
import { signInWithPasskey, useSingleCeremony } from "@app/passkeys";
import {
	cancelEmailRemediationFn,
	changeEmailRemediationFn,
	completeEmailRemediationFn,
	createFirstUserFn,
	getEmailRemediationFn,
	loginFn,
	promoteEmailRemediationFn,
	resendEmailRemediationFn,
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

/** Query options for resumable restricted email-remediation state. */
export function emailRemediationQueryOptions() {
	return queryOptions({
		queryKey: ["email-remediation"],
		queryFn: () => getEmailRemediationFn(),
		refetchInterval: (query) =>
			query.state.data?.status === "pending" ? 3_000 : false,
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
		{ handle: string; email: string; password: string }
	>({
		mutationFn: ({ handle, email, password }) =>
			createFirstUserFn({ data: { handle, email, password } }),
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
			queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}

/**
 * Initializes a mutator for sending a login request to the API.
 *
 * The caller resolves the next step, which drops the previous principal's
 * caches.
 */
export function useLoginMutation() {
	return useMutation<LoginResult, Error, { handle: string; password: string }>({
		mutationFn: ({ handle, password }) =>
			loginFn({ data: { handle, password } }),
	});
}

/**
 * Initializes a mutator that signs in with a passkey.
 *
 * A passkey verifies the user, so a TOTP-enrolled user does not get the
 * second-factor step.
 */
export function usePasskeySignInMutation() {
	const ceremony = useSingleCeremony(signInWithPasskey);

	return useMutation<void, Error, void>({
		mutationFn: ceremony,
	});
}

/** Initializes a mutator that changes the password of a forced-reset session. */
export function useResetPasswordMutation() {
	return useMutation({
		mutationFn: ({ password }: { password: string }) =>
			resetPasswordFn({ data: { password } }),
	});
}

/** Verify a second factor to finish signing in. */
export function useVerifyTwoFactorMutation() {
	return useMutation({
		mutationFn: (data: { code: string; recovery: boolean }) =>
			verifyTwoFactorFn({ data }),
	});
}

/** Submit an address for online verification or offline completion. */
export function useSubmitEmailRemediation() {
	return useMutation({
		mutationFn: ({ email, redirect }: { email: string; redirect?: string }) =>
			submitEmailRemediationFn({ data: { email, redirect } }),
	});
}

/** Send a replacement challenge for the currently staged address. */
export function useResendEmailRemediation() {
	return useMutation({
		mutationFn: ({ redirect }: { redirect?: string }) =>
			resendEmailRemediationFn({ data: { redirect } }),
	});
}

/** Revoke the staged challenge and return to address entry. */
export function useChangeEmailRemediation() {
	return useMutation({ mutationFn: () => changeEmailRemediationFn() });
}

/** Promote a matching restricted browser after cross-browser verification. */
export function usePromoteEmailRemediation() {
	return useMutation({ mutationFn: () => promoteEmailRemediationFn() });
}

/** Complete remediation with the one-time mailbox token. */
export function completeEmailRemediation(token: string) {
	return completeEmailRemediationFn({ data: { token } });
}

/** Abandon the restricted flow and clear every browser credential. */
export function useCancelEmailRemediation() {
	return useMutation({ mutationFn: () => cancelEmailRemediationFn() });
}
