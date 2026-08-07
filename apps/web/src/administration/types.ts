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
 * Instance-wide settings
 */
export type Settings = {
	defaultSourceTypes: string[];
	enableSentry: boolean;
	minimumPasswordLength: number;
	sampleAllRead: boolean;
	sampleAllWrite: boolean;
	sampleGroup: string;
	sampleGroupRead: boolean;
	sampleGroupWrite: boolean;
};
