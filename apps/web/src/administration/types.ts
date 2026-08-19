/**
 * Types related to administrative management of Virtool.
 */

import type { AdministratorRoleName } from "@virtool/contracts";

/**
 * Full model of an administrator role
 */
export type AdministratorRole = {
	description: string;
	id: AdministratorRoleName;
	name: string;
};

/**
 * Instance-wide settings, as the server publishes them.
 *
 * The NCBI API key is a credential and never crosses the wire. Only
 * `hasNcbiApiKey` says whether one is configured; the form writes a new key or
 * clears it, and cannot read the stored one back.
 */
export type Settings = {
	defaultSourceTypes: string[];
	enableSentry: boolean;
	hasNcbiApiKey: boolean;
	minimumPasswordLength: number;
	sampleAllRead: boolean;
	sampleAllWrite: boolean;
	sampleGroup: string;
	sampleGroupRead: boolean;
	sampleGroupWrite: boolean;
};
