import { accountQueryKeys } from "@account/keys";
import { useRecentlyAuthenticatedMutation } from "@app/recentAuthentication";
import { resetClient } from "@app/utils";
import * as Sentry from "@sentry/tanstackstart-react";
import {
	createApiKeyFn,
	deleteApiKeyFn,
	findApiKeysFn,
	updateApiKeyFn,
} from "@server/account/functions";
import { logoutFn } from "@server/auth/functions";
import { requestAccountEmailChangeFn } from "@server/auth/recoveryFunctions";
import {
	changePasswordFn,
	updateAccountHandleFn,
	updateAccountSettingsFn,
} from "@server/users/functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	Account,
	AccountSettings,
	ApiKey,
	Permissions,
} from "@virtool/contracts";

/**
 * Initializes a mutator for requesting verification of a new email address.
 *
 * @returns A mutator for queuing an email challenge.
 */
export function useUpdateAccount() {
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ email }: { email: string }) =>
			requestAccountEmailChangeFn({ data: { email } }),
	);

	return useMutation<
		Awaited<ReturnType<typeof requestAccountEmailChangeFn>>,
		Error,
		{ email: string }
	>({
		mutationFn,
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
 * Initializes a mutator for changing the current account's settings.
 *
 * The cached account takes the change at once, so a control bound to a setting
 * does not wait on the round trip. A failed change puts the old settings back.
 *
 * @returns A mutator for changing the account settings
 */
export function useUpdateAccountSettings() {
	const queryClient = useQueryClient();

	return useMutation<
		AccountSettings,
		Error,
		Partial<AccountSettings>,
		{ previous: Account | undefined }
	>({
		mutationFn: (settings) => updateAccountSettingsFn({ data: settings }),
		onMutate: async (settings) => {
			await queryClient.cancelQueries({
				exact: true,
				queryKey: accountQueryKeys.all(),
			});

			const previous = queryClient.getQueryData<Account>(
				accountQueryKeys.all(),
			);

			if (previous) {
				queryClient.setQueryData<Account>(accountQueryKeys.all(), {
					...previous,
					settings: { ...previous.settings, ...settings },
				});
			}

			return { previous };
		},
		onError: (_error, _settings, context) => {
			if (context?.previous) {
				queryClient.setQueryData(accountQueryKeys.all(), context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				exact: true,
				queryKey: accountQueryKeys.all(),
			});
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
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ oldPassword, password }: { oldPassword: string; password: string }) =>
			changePasswordFn({ data: { oldPassword, password } }),
	);

	return useMutation<
		Awaited<ReturnType<typeof changePasswordFn>>,
		Error,
		{ oldPassword: string; password: string }
	>({
		mutationFn,
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
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ name, permissions }: { name: string; permissions: Permissions }) =>
			createApiKeyFn({ data: { name, permissions } }),
	);

	return useMutation<
		Awaited<ReturnType<typeof createApiKeyFn>>,
		Error,
		{ name: string; permissions: Permissions }
	>({
		mutationFn,
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
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ keyId, permissions }: { keyId: number; permissions: Permissions }) =>
			updateApiKeyFn({ data: { keyId, permissions } }),
	);

	return useMutation<
		Awaited<ReturnType<typeof updateApiKeyFn>>,
		Error,
		{ keyId: number; permissions: Permissions }
	>({
		mutationFn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.apiKeys() });
		},
	});
}

/**
 * Initializes a mutator for deleting an API key
 *
 * @returns A mutator for deleting an API key
 */
export function useDeleteApiKey() {
	const queryClient = useQueryClient();
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ keyId }: { keyId: number }) => deleteApiKeyFn({ data: { keyId } }),
	);

	return useMutation<null, Error, { keyId: number }>({
		mutationFn,
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
