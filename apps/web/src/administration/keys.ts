import { createQueryKeys } from "@app/queryKeys";

/** Query keys for the server settings. */
export const settingsQueryKeys = createQueryKeys("settings");

/**
 * Query keys for the instance email delivery configuration.
 *
 * Apart from the settings keys so that a configuration change does not refetch
 * unrelated settings, and so that only a full administrator's queries carry
 * this namespace.
 */
export const emailQueryKeys = createQueryKeys("email");

/** Query keys for administrator roles. */
export const roleQueryKeys = createQueryKeys("roles");

/** Query keys for the instance password policy. */
export const passwordPolicyQueryKeys = createQueryKeys("passwordPolicy");
