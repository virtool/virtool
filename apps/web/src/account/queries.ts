import { accountQueryKeys } from "@account/keys";
import { resetClient } from "@app/utils";
import * as Sentry from "@sentry/tanstackstart-react";
import {
	createApiKeyFn,
	deleteApiKeyFn,
	findApiKeysFn,
	updateApiKeyFn,
} from "@server/account/functions";
import { logoutFn } from "@server/auth/functions";
import {
	changePasswordFn,
	updateAccountEmailFn,
	updateAccountHandleFn,
} from "@server/users/functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiKey, Permissions } from "@virtool/contracts";

/**
 * Initializes a mutator for updating the current account's email address
 *
 * @returns A mutator for updating the account email
 */
export function useUpdateAccount() {
	const queryClient = useQueryClient();

	return useMutation<
		Awaited<ReturnType<typeof updateAccountEmailFn>>,
		Error,
		{ email: string }
	>({
		mutationFn: ({ email }) => updateAccountEmailFn({ data: { email } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}

/**
 * Initializes a mutator for changing the current account's handle
 *
 * @returns A mutator for changing the account handle
 */
export function useUpdateHandle() {
	const queryClient = useQueryClient();

	return useMutation<
		Awaited<ReturnType<typeof updateAccountHandleFn>>,
		Error,
		{ handle: string }
	>({
		mutationFn: ({ handle }) => updateAccountHandleFn({ data: { handle } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}

/**
 * Initializes a mutator for changing the current account's password
 *
 * @returns A mutator for changing the account password
 */
export function useChangePassword() {
	const queryClient = useQueryClient();

	return useMutation<
		Awaited<ReturnType<typeof changePasswordFn>>,
		Error,
		{ oldPassword: string; password: string }
	>({
		mutationFn: ({ oldPassword, password }) =>
			changePasswordFn({ data: { oldPassword, password } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
		},
	});
}

/**
 * Fetches the API keys for the current user
 *
 * @returns A list of API keys for the current user
 */
export function useFetchApiKeys() {
	return useQuery<ApiKey[]>({
		queryKey: accountQueryKeys.apiKeys(),
		queryFn: () => findApiKeysFn(),
	});
}

/**
 * Initializes a mutator for creating a new API key
 *
 * @returns A mutator for creating a new API key
 */
export function useCreateApiKey() {
	const queryClient = useQueryClient();

	return useMutation<
		Awaited<ReturnType<typeof createApiKeyFn>>,
		Error,
		{ name: string; permissions: Permissions }
	>({
		mutationFn: ({ name, permissions }) =>
			createApiKeyFn({ data: { name, permissions } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.apiKeys() });
		},
	});
}

/**
 * Initializes a mutator for updating an API key
 *
 * @returns A mutator for updating an API key
 */
export function useUpdateApiKey() {
	const queryClient = useQueryClient();

	return useMutation<
		Awaited<ReturnType<typeof updateApiKeyFn>>,
		Error,
		{ keyId: number; permissions: Permissions }
	>({
		mutationFn: ({ keyId, permissions }) =>
			updateApiKeyFn({ data: { keyId, permissions } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.apiKeys() });
		},
	});
}

/**
 * Initializes a mutator for removing an API key
 *
 * @returns A mutator for removing an API key
 */
export function useRemoveApiKey() {
	const queryClient = useQueryClient();

	return useMutation<null, Error, { keyId: number }>({
		mutationFn: ({ keyId }) => deleteApiKeyFn({ data: { keyId } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.apiKeys() });
		},
	});
}

/**
 * Initializes a mutator for logging out a user
 *
 * @returns A mutator for logging out a user
 */
export function useLogout() {
	return useMutation<null, Error>({
		mutationFn: () => logoutFn(),
		onSuccess: () => {
			Sentry.setUser(null);
			resetClient();
		},
	});
}
