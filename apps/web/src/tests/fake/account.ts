import type { Account, AccountSettings } from "@account/types";
import { faker } from "@faker-js/faker";
import type { ApiKey } from "@virtool/contracts";
import { createFakePermissions } from "./permissions";
import { createFakeUser } from "./user";

const defaultSettings: AccountSettings = {
	quickAnalyzeWorkflow: "pathoscope",
	showIds: true,
	showVersions: true,
	skipQuickAnalyzeDialog: true,
};

export function createFakeAccount(overrides?: Partial<Account>): Account {
	const { settings, email, ...userProps } = overrides || {};

	return {
		email: email ?? faker.internet.email(),
		settings: { ...defaultSettings, ...settings },
		...createFakeUser(userProps),
	};
}

/**
 * Create a fake API key
 *
 * @param overrides - optional properties for creating a fake API key with specific values
 */
export function createFakeApiKey(overrides?: Partial<ApiKey>): ApiKey {
	return {
		createdAt: faker.date.past(),
		id: faker.number.int({ min: 1, max: 100000 }),
		name: faker.word.noun({ strategy: "any-length" }),
		permissions: createFakePermissions({
			cancel_job: true,
			create_ref: true,
		}),
		...overrides,
	};
}
