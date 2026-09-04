import type { SetupPurpose } from "@virtool/contracts";

/** A server function a restricted setup principal may call, and for what. */
export type SetupEndpoint = {
	fn: { url: string };
	purpose: SetupPurpose;
};

/**
 * Every server function reachable by a restricted setup principal, and the one
 * purpose each answers.
 *
 * The allowlist half of the setup boundary. The global authentication
 * middleware refuses a restricted caller anything absent from here *before*
 * the function's own policy runs, so a setup function left out of this list is
 * unreachable rather than open — the same failure direction
 * `./exceptions` has.
 *
 * A function listed here must also declare `setupOnly()` with the matching
 * purpose, and one declaring `setupOnly()` must appear here.
 * `authorization.test.ts` pins both directions, so the two cannot drift.
 *
 * **It is deliberately empty.** The setup surfaces themselves — invitation and
 * bootstrap completion, account recovery, required-TOTP enrollment — are the
 * dependent issues' work. This issue builds the boundary they are declared
 * against, and an empty allowlist means a restricted principal currently
 * reaches nothing at all, which is the right default for a door with no rooms
 * behind it yet.
 *
 * @public
 */
export const setupEndpoints: ReadonlyArray<SetupEndpoint> = [];
