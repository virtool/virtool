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
