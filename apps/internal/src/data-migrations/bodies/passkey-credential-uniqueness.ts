import { type DataMigrationArgs, defineAudit } from "../define";

type DuplicateCredential = {
	passkeyIds: number[];
};

async function audit({ client, signal, report }: DataMigrationArgs) {
	signal.throwIfAborted();
	const duplicates = await client<DuplicateCredential[]>`
		SELECT array_agg(id ORDER BY id) AS "passkeyIds"
		FROM public.auth_passkeys
		GROUP BY credential_id
		HAVING count(*) > 1
		ORDER BY min(id)
	`;

	// The credential id itself is never reported. The row ids are enough to find
	// the duplicates, and the findings table is readable by operators.
	for (const duplicate of duplicates) {
		signal.throwIfAborted();
		report({
			code: "duplicate_passkey_credential",
			subject: `passkey:${duplicate.passkeyIds[0]}`,
			detail: { passkeyIds: duplicate.passkeyIds },
		});
	}

	return { duplicateCredentials: duplicates.length };
}

/** Audit paired with the migration that enforces unique passkey credential ids. */
export const passkeyCredentialUniqueness = defineAudit({
	key: "passkey_credential_uniqueness",
	version: 1,
	migrationTag: "0043_enforce_passkey_credential_uniqueness",
	kind: "audit",
	description: "report passkey credential ids registered more than once",
	run: audit,
});
