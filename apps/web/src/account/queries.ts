import { accountQueryKeys } from "@account/keys";
import type { ApiKey } from "@account/types";
import { apiClient } from "@app/api";
import { resetClient } from "@app/utils";
import type { Permissions } from "@groups/types";
import * as Sentry from "@sentry/tanstackstart-react";
import {
	createApiKeyFn,
	deleteApiKeyFn,
	findApiKeysFn,
	updateApiKeyFn,
} from "@server/account/functions";
import { logoutFn } from "@server/auth/functions";
import { updateAccountHandleFn } from "@server/users/functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@users/types";
import type { ErrorResponse } from "@/types/api";

/** Fields that can be changed when updating the current account */
export type AccountUpdate = {
	email?: string;
};

/**
 * Initializes a mutator for updating a user
 *
 * @returns A mutator for updating a user
 */
export function useUpdateAccount() {
	const queryClient = useQueryClient();

	return useMutation<User, ErrorResponse, { update: AccountUpdate }>({
		mutationFn: ({ update }) =>
			apiClient
				.patch("/account")
				.send({ update })
				.then((res) => res.body),
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
 * Initializes a mutator for updating a user
 *
 * @returns A mutator for updating a user
 */
export function useChangePassword() {
	const queryClient = useQueryClient();

	return useMutation<
		User,
		ErrorResponse,
		{ old_password: string; password: string }
	>({
		mutationFn: ({ old_password, password }) =>
			apiClient
				.patch("/account")
				.send({ old_password, password })
				.then((res) => res.body),
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
	return useMutation<null, ErrorResponse>({
		mutationFn: () => logoutFn(),
		onSuccess: () => {
			Sentry.setUser(null);
			resetClient();
		},
	});
}
