import type { AdministratorRole, Settings } from "@administration/types";
import { faker } from "@faker-js/faker";

export const administratorRoles: AdministratorRole[] = [
	{
		description: "Manage who is an administrator and what they can do.",
		id: "full",
		name: "Full",
	},
	{
		description: "Manage instance settings.",
		id: "settings",
		name: "Settings",
	},
	{
		description: "Manage users in any space. Delete any space.",
		id: "spaces",
		name: "Spaces",
	},
	{
		description: "Create user accounts. Control activation of user accounts.",
		id: "users",
		name: "Users",
	},
	{
		description:
			"Provides ability to:\n    - Create new spaces even if the `Free Spaces` setting is not enabled.\n    - Manage HMMs and common references.\n    - View all running jobs.\n    - Cancel any job.",
		id: "base",
		name: "Base",
	},
];

/**
 * Create fake settings
 *
 * @param overrides - optional properties for creating fake settings with specific values
 */
export function createFakeSettings(overrides?: Partial<Settings>): Settings {
	const defaultSettings = {
		defaultSourceTypes: [faker.word.noun({ strategy: "any-length" })],
		enableSentry: faker.datatype.boolean(),
		minimumPasswordLength: 8,
		sampleAllRead: faker.datatype.boolean(),
		sampleAllWrite: faker.datatype.boolean(),
		sampleGroup: "none",
		sampleGroupRead: faker.datatype.boolean(),
		sampleGroupWrite: faker.datatype.boolean(),
	};

	return { ...defaultSettings, ...overrides };
}
