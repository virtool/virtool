import { accountQueryKeys } from "@account/keys";
import { createPasskey, useSingleCeremony } from "@app/passkeys";
import { useRecentlyAuthenticatedMutation } from "@app/recentAuthentication";
import { resetClient } from "@app/utils";
import * as Sentry from "@sentry/tanstackstart-react";
import {
	createApiKeyFn,
	deleteApiKeyFn,
	findApiKeysFn,
	findPasskeysFn,
	getPasskeyRegistrationOptionsFn,
	registerPasskeyFn,
	removePasskeyFn,
	renamePasskeyFn,
	updateApiKeyFn,
} from "@server/account/functions";
import { logoutFn } from "@server/auth/functions";
import {
	getEmailDeliveryAvailableFn,
	requestAccountEmailChangeFn,
} from "@server/auth/recoveryFunctions";
import {
	changePasswordFn,
	updateAccountHandleFn,
	updateAccountSettingsFn,
} from "@server/users/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	Account,
	AccountSettings,
	ApiKey,
	PasskeySummary,
	Permissions,
} from "@virtool/contracts";

const ACCOUNT_SETTINGS_MUTATION_KEY = ["account", "settings"];

/** Query options for whether this instance can send email. */
export function emailDeliveryQueryOptions() {
	return queryOptions({
		queryKey: accountQueryKeys.emailDelivery(),
		queryFn: () => getEmailDeliveryAvailableFn(),
	});
}

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
 * Changes run one at a time, so a quick second change cannot reach the server
 * first and be overwritten by the one it replaced.
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
		mutationKey: ACCOUNT_SETTINGS_MUTATION_KEY,
		scope: { id: "account-settings" },
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
			// A refetch while a queued change waits would show the settings from
			// before that change.
			if (
				queryClient.isMutating({ mutationKey: ACCOUNT_SETTINGS_MUTATION_KEY }) >
				1
			) {
				return;
			}

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

/** Query options for the current user's passkeys. */
export function passkeysQueryOptions() {
	return queryOptions({
		queryKey: accountQueryKeys.passkeys(),
		queryFn: () => findPasskeysFn(),
	});
}

/**
 * Initializes a mutator that registers a passkey for the current user.
 *
 * Both server calls take part in the recent-authentication challenge on their
 * own, so a session that goes stale while the browser dialog is open is
 * challenged once and the registration completes without a second ceremony.
 */
export function useRegisterPasskey() {
	const queryClient = useQueryClient();
	const getOptions = useRecentlyAuthenticatedMutation(() =>
		getPasskeyRegistrationOptionsFn(),
	);
	const register = useRecentlyAuthenticatedMutation(
		(response: Awaited<ReturnType<typeof createPasskey>>) =>
			registerPasskeyFn({ data: { response } }),
	);
	const ceremony = useSingleCeremony(async () =>
		register(await createPasskey(await getOptions(undefined))),
	);

	return useMutation<PasskeySummary, Error, void>({
		mutationFn: ceremony,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.passkeys() });
		},
	});
}

/** Initializes a mutator that renames one of the current user's passkeys. */
export function useRenamePasskey() {
	const queryClient = useQueryClient();
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ managementId, name }: { managementId: number; name: string }) =>
			renamePasskeyFn({ data: { managementId, name } }),
	);

	return useMutation<
		PasskeySummary,
		Error,
		{ managementId: number; name: string }
	>({
		mutationFn,
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.passkeys() });
		},
	});
}

/** Initializes a mutator that removes one of the current user's passkeys. */
export function useRemovePasskey() {
	const queryClient = useQueryClient();
	const mutationFn = useRecentlyAuthenticatedMutation(
		({ managementId }: { managementId: number }) =>
			removePasskeyFn({ data: { managementId } }),
	);

	return useMutation<null, Error, { managementId: number }>({
		mutationFn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: accountQueryKeys.passkeys() });
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
