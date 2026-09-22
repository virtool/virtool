import { createQueryKeys } from "@app/queryKeys";

const accountKeys = createQueryKeys("account");

/**
 * Query keys for the logged-in user's account.
 *
 * The account is a singleton, so it is cached at `all()` itself. `apiKeys()`
 * is the sub-collection of the account's API keys, nested under `all()` so
 * that any account mutation refreshes it too.
 */
export const accountQueryKeys = {
	...accountKeys,
	apiKeys: () => [...accountKeys.all(), "keys"] as const,
	activeSessions: () => [...accountKeys.all(), "sessions"] as const,
};
