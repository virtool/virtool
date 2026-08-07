import {
	passwordPolicyQueryKeys,
	roleQueryKeys,
	settingsQueryKeys,
} from "@administration/keys";
import { getSettingsFn, updateSettingsFn } from "@server/settings/functions";
import { listAdministratorRolesFn } from "@server/users/functions";
import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { Settings } from "./types";

/** Fields that can be changed when updating the server settings */
export type SettingsUpdate = {
	defaultSourceTypes?: string[];
	enableSentry?: boolean;
	minimumPasswordLength?: number;
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
