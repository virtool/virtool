import { accountQueryKeys } from "@account/keys";
import {
	createFirstUserFn,
	loginFn,
	resetPasswordFn,
} from "@server/auth/functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rootQueryKeys } from "@wall/keys";

/** Result of a login attempt. `resetCode` is only set when `reset` is true. */
export type LoginResult = {
	reset: boolean;
	resetCode?: string;
};

/** Result of a successful password reset. */
export type ResetPasswordResult = {
	login: false;
	reset: false;
};

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

	return useMutation<
		LoginResult,
		Error,
		{ handle: string; password: string; remember: boolean }
	>({
		mutationFn: ({ handle, password, remember }) =>
			loginFn({ data: { handle, password, remember } }),
		onSuccess: (data) => {
			if (!data.reset) {
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

	return useMutation<
		ResetPasswordResult,
		Error,
		{ password: string; resetCode: string }
	>({
		mutationFn: ({ password, resetCode }) =>
			resetPasswordFn({ data: { password, resetCode } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}
