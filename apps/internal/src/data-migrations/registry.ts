import { CREDENTIAL_PROVIDER_ID, credentialAccountId } from "@virtool/data/auth/credential";
import { isBcryptHash } from "@virtool/data/auth/migration";
import { isValidEmail, normalizeEmail } from "@virtool/data/auth/email";

import { defineAudit, type DataMigrationRegistry } from "./define";

/** Audit the legacy identity population before the authentication cutover. */
const legacyIdentities = defineAudit({
	key: "legacy_identities",
	version: 1,
	migrationTag: "0028_audit_legacy_identities",
	kind: "audit",
	description: "audit legacy users and Better Auth credential accounts",
	async run({ client, report, signal }) {
		const users = await client<
			{
				id: number;
				handle: string;
				active: boolean;
				email: string;
				password: Buffer | null;
				auth_migrated_at: Date | null;
			}[]
		>`select id, handle, active, email, password, auth_migrated_at
		  from users order by id`;

		const accounts = await client<
			{ account_id: string; user_id: number; password: string | null }[]
		>`select account_id, user_id, password from auth_accounts
		  where provider_id = ${CREDENTIAL_PROVIDER_ID} order by user_id, id`;

		const byUser = new Map<number, Array<(typeof accounts)[number]>>();
		for (const account of accounts) {
			const rows = byUser.get(account.user_id) ?? [];
			rows.push(account);
			byUser.set(account.user_id, rows);
		}

		const duplicateCounts = new Map<string, number>();
		for (const user of users) {
			if (isValidEmail(user.email)) {
				const email = normalizeEmail(user.email);
				duplicateCounts.set(email, (duplicateCounts.get(email) ?? 0) + 1);
			}
		}

		for (const user of users) {
			signal.throwIfAborted();
			const userAccounts = byUser.get(user.id) ?? [];
			const account = userAccounts[0];
			const subject = `user:${user.id}`;

			if (userAccounts.length > 1) {
				report({ code: "credential_conflict", subject });
				continue;
			}

			if (account !== undefined) {
				if (
					account.account_id !== credentialAccountId(user.id) ||
					account.user_id !== user.id ||
					account.password === null ||
					user.password === null ||
					user.auth_migrated_at === null
				) {
					report({ code: "credential_conflict", subject });
				} else if (account.password !== user.password.toString("utf8")) {
					report({ code: "stale_credential", subject });
				}
				continue;
			}

			if (user.auth_migrated_at !== null) {
				report({ code: "missing_credential", subject });
				continue;
			}

			const email = normalizeEmail(user.email);
			if (email === "") {
				report({ code: "blank_email", subject });
			} else if (!isValidEmail(user.email)) {
				report({ code: "invalid_email", subject });
			} else if ((duplicateCounts.get(email) ?? 0) > 1) {
				report({ code: "duplicate_email", subject, detail: { email } });
			}

			if (!isBcryptHash(user.password)) {
				report({ code: "invalid_password", subject });
			}
		}
	},
});

/** Registered data migrations, indexed by their stable key. */
export const DATA_MIGRATIONS: DataMigrationRegistry = {
	[legacyIdentities.key]: legacyIdentities,
};
