import {
	emailQueryKeys,
	passwordPolicyQueryKeys,
	roleQueryKeys,
	settingsQueryKeys,
} from "@administration/keys";
import {
	clearEmailApiKeyFn,
	getEmailSettingsFn,
	reencryptEmailApiKeyFn,
	sendTestEmailFn,
	setEmailApiKeyFn,
	updateEmailSettingsFn,
} from "@server/email/functions";
import { getSettingsFn, updateSettingsFn } from "@server/settings/functions";
import { listAdministratorRolesFn } from "@server/users/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type {
	EmailReencryptResult,
	EmailSettings,
	EmailTestResult,
	Settings,
} from "@virtool/contracts";

/** Fields that can be changed when updating the server settings */
export type SettingsUpdate = {
	/** A new cache storage eviction budget, in bytes. */
	cacheStorageBudget?: number;
	defaultSourceTypes?: string[];
	enableSentry?: boolean;
	minimumPasswordLength?: number;
	/** A new NCBI API key, or `""` to clear the configured one. */
	ncbiApiKey?: string;
	sampleAllRead?: boolean;
	sampleAllWrite?: boolean;
	sampleGroup?: string;
	sampleGroupRead?: boolean;
	sampleGroupWrite?: boolean;
};

/**
 * Query options for the API settings.
 */
export function settingsQueryOptions() {
	return queryOptions<Settings>({
		queryKey: settingsQueryKeys.all(),
		queryFn: () => getSettingsFn(),
	});
}

/**
 * Fetch the API settings without suspending.
 *
 * For components on routes that do not prefetch the settings, and for the
 * settings route itself, which any `users` administrator can reach but only a
 * `settings` administrator may read — so the query has to be allowed to fail
 * beside the parts of the view that do render.
 */
export function useFetchSettings() {
	return useQuery(settingsQueryOptions());
}

/**
 * Fetch the API settings, suspending until they resolve.
 *
 * `data` is always defined, and a failed request throws to the nearest route
 * error boundary. Use this from components rendered under a route whose loader
 * prefetches the settings.
 */
export function useSuspenseSettings() {
	return useSuspenseQuery(settingsQueryOptions());
}

/**
 * Initializes a mutator for updating the current settings on the server
 *
 * @returns A mutator for updating the current settings on the server
 */
export function useUpdateSettings() {
	const queryClient = useQueryClient();

	return useMutation<Settings, Error, SettingsUpdate>({
		mutationFn: (update) => updateSettingsFn({ data: update }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: settingsQueryKeys.all(),
			});
			// The minimum password length lives in these settings, so the policy the
			// password forms validate against has just gone stale.
			queryClient.invalidateQueries({
				queryKey: passwordPolicyQueryKeys.all(),
			});
		},
	});
}

/**
 * Query options for fetching the list of valid administrator roles.
 */
export function administratorRolesQueryOptions() {
	return queryOptions({
		queryKey: roleQueryKeys.all(),
		queryFn: () => listAdministratorRolesFn(),
	});
}

/**
 * Fetch a list of valid administrator roles from the backend
 *
 * @returns A list of valid administrator roles
 */
export function useGetAdministratorRoles() {
	return useQuery(administratorRolesQueryOptions());
}

/**
 * Query options for the instance email delivery configuration.
 *
 * The response carries non-secret fields and a flag saying whether a key is
 * stored; the key itself never leaves the server.
 */
function emailSettingsQueryOptions() {
	return queryOptions<EmailSettings>({
		queryKey: emailQueryKeys.all(),
		queryFn: () => getEmailSettingsFn(),
	});
}

/**
 * Fetch the email delivery configuration without suspending.
 *
 * Only a full administrator may read it, so this is called from a subtree that
 * is already gated on that role. Every mutation below refetches it rather than
 * writing its own result into the cache: availability depends on decryption,
 * which only the server can judge.
 */
export function useFetchEmailSettings() {
	return useQuery(emailSettingsQueryOptions());
}

/** The non-secret email delivery fields that can be changed. */
export type EmailSettingsUpdate = {
	enabled?: boolean;
	/** An address replies go to, or `""` to send them to the sender address. */
	replyToAddress?: string;
	senderAddress?: string;
	senderName?: string;
};

function useEmailInvalidation() {
	const queryClient = useQueryClient();

	return () =>
		queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
}

/** Update the non-secret email delivery settings. */
export function useUpdateEmailSettings() {
	const invalidate = useEmailInvalidation();

	return useMutation<EmailSettings, Error, EmailSettingsUpdate>({
		mutationFn: (update) => updateEmailSettingsFn({ data: update }),
		onSuccess: invalidate,
	});
}

/** Store a new Resend API key, replacing any already stored. */
export function useSetEmailApiKey() {
	const invalidate = useEmailInvalidation();

	return useMutation<EmailSettings, Error, string>({
		mutationFn: (apiKey) => setEmailApiKeyFn({ data: { apiKey } }),
		onSuccess: invalidate,
	});
}

/** Remove the stored Resend API key, which also disables delivery. */
export function useClearEmailApiKey() {
	const invalidate = useEmailInvalidation();

	return useMutation<EmailSettings, Error, void>({
		mutationFn: () => clearEmailApiKeyFn(),
		onSuccess: invalidate,
	});
}

/** Re-encrypt the stored API key under the active encryption key. */
export function useReencryptEmailApiKey() {
	const invalidate = useEmailInvalidation();

	return useMutation<EmailReencryptResult, Error, void>({
		mutationFn: () => reencryptEmailApiKeyFn(),
		onSuccess: invalidate,
	});
}

/**
 * Send a test email to one recipient.
 *
 * A configuration failure means the stored settings are worse than the last
 * read said, so the configuration is refetched on every outcome.
 */
export function useSendTestEmail() {
	const invalidate = useEmailInvalidation();

	return useMutation<EmailTestResult, Error, string>({
		mutationFn: (recipient) => sendTestEmailFn({ data: { recipient } }),
		onSettled: invalidate,
	});
}
