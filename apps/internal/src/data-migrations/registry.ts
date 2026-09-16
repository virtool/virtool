import {
	type IdentityClassification,
	runIdentityMigration,
} from "@virtool/data/auth/migration";

import { type DataMigrationRegistry, defineAudit } from "./define";

function getFindingCode(
	classification: IdentityClassification,
): string | undefined {
	switch (classification) {
		case "conflict":
			return "credential_conflict";
		case "invalidHandle":
			return "invalid_handle";
		case "invalidPassword":
			return "invalid_password";
		default:
			return undefined;
	}
}

/** Eagerly migrate safe legacy identities before the authentication cutover. */
const legacyIdentities = defineAudit({
	key: "legacy_identities",
	version: 2,
	migrationTag: "0029_audit_legacy_identities",
	kind: "audit",
	description: "migrate eligible legacy users and report unsafe identities",
	async run({ db, logger, report, signal }) {
		const result = await runIdentityMigration(db, logger, {
			mode: "apply",
			signal,
		});

		for (const row of result.rows) {
			signal.throwIfAborted();
			const code = getFindingCode(row.classification);

			if (code !== undefined) {
				report({
					code,
					subject: `user:${row.userId}`,
				});
			}
		}

		return {
			users: result.users,
			counts: result.counts,
			credentials: result.credentials,
		};
	},
});

/** Registered data migrations, indexed by their stable key. */
export const DATA_MIGRATIONS: DataMigrationRegistry = {
	[legacyIdentities.key]: legacyIdentities,
};
