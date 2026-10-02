import type { SetupPurpose } from "@virtool/contracts";
import {
	cancelEmailRemediationFn,
	changeEmailRemediationFn,
	getEmailRemediationFn,
	promoteEmailRemediationFn,
	resendEmailRemediationFn,
	submitEmailRemediationFn,
} from "./functions";

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
 * @public
 */
export const setupEndpoints: ReadonlyArray<SetupEndpoint> = [
	{
		fn: cancelEmailRemediationFn,
		purpose: "email_remediation",
	},
	{
		fn: changeEmailRemediationFn,
		purpose: "email_remediation",
	},
	{
		fn: promoteEmailRemediationFn,
		purpose: "email_remediation",
	},
	{
		fn: resendEmailRemediationFn,
		purpose: "email_remediation",
	},
	{
		fn: getEmailRemediationFn,
		purpose: "email_remediation",
	},
	{
		fn: submitEmailRemediationFn,
		purpose: "email_remediation",
	},
];
