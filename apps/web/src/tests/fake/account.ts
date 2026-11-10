import { faker } from "@faker-js/faker";
import {
	type Account,
	type AccountSecurity,
	type AccountSettings,
	type ApiKey,
	PATHOSCOPE_COLUMNS,
} from "@virtool/contracts";
import { createFakePermissions } from "./permissions";
import { createFakeUser } from "./user";

const defaultSettings: AccountSettings = {
	avatarSource: "initials",
	pathoscopeColumns: [...PATHOSCOPE_COLUMNS],
	preferAcronym: false,
	quickAnalyzeWorkflow: "pathoscope",
	referenceExportFastaHeader: "full",
	referenceExportTableFormat: "csv",
	showIds: true,
	showVersions: true,
	skipQuickAnalyzeDialog: true,
	timeFormat: "relative",
};

/** Creates the security state of an account with a verified address and no TOTP. */
export function createFakeAccountSecurity(
	overrides?: Partial<AccountSecurity>,
): AccountSecurity {
	return {
		emailVerified: true,
		mfaRequired: false,
		pendingEmail: null,
		recoveryCodesRemaining: null,
		twoFactorEnabled: false,
		...overrides,
	};
}

export function createFakeAccount(overrides?: Partial<Account>): Account {
	const { settings, email, lastSeenChangelogAt, ...userProps } =
		overrides || {};

	return {
		email: email ?? faker.internet.email(),
		lastSeenChangelogAt: lastSeenChangelogAt ?? faker.date.past(),
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
			create_ref: true,
		}),
		...overrides,
	};
}
