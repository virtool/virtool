import type { DataMigrationRegistry, RegisteredDataMigration } from "./define";

/** The journal entry that creates the framework's own tables. */
export const BOOTSTRAP_MIGRATION_TAG = "0026_add_data_migrations";

/** A journaled SQL migration and its statements. */
export type MigrationFile = { tag: string; sql: string[] };

/** The required first statement of a SQL migration paired with a body. */
export function getDataMigrationAssertion(
	key: string,
	version: number,
): string {
	return `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_migrations
                 WHERE key = '${key}' AND version = ${version} AND status = 'passed')
  THEN RAISE EXCEPTION 'data migration ${key}@${version} has not passed';
  END IF;
END $$;`;
}

function normalize(statement: string): string {
	return statement.replace(/\s+/g, " ").trim();
}

/** Validate one-to-one pairings and their database-enforced preconditions. */
export function validateMigrationPairs(
	files: MigrationFile[],
	registry: DataMigrationRegistry,
): Map<string, RegisteredDataMigration> {
	const bootstrap = files.findIndex(
		(file) => file.tag === BOOTSTRAP_MIGRATION_TAG,
	);
	if (bootstrap < 0) {
		throw new Error(
			`bootstrap migration ${BOOTSTRAP_MIGRATION_TAG} is missing`,
		);
	}
	const pairs = new Map<string, RegisteredDataMigration>();
	for (const [key, definition] of Object.entries(registry)) {
		if (key !== definition.key || !/^[a-z][a-z0-9_]*$/.test(key)) {
			throw new Error(`invalid data migration key ${key}`);
		}
		if (!Number.isSafeInteger(definition.version) || definition.version < 1) {
			throw new Error(`invalid version for data migration ${key}`);
		}
		if (
			definition.kind === "backfill" &&
			(!Number.isSafeInteger(definition.batchSize) || definition.batchSize < 1)
		) {
			throw new Error(`invalid batch size for data migration ${key}`);
		}
		const index = files.findIndex(
			(file) => file.tag === definition.migrationTag,
		);
		if (index < 0) {
			throw new Error(
				`paired migration ${definition.migrationTag} is missing from the journal`,
			);
		}
		if (index <= bootstrap) {
			throw new Error(
				`paired migration ${definition.migrationTag} must follow ${BOOTSTRAP_MIGRATION_TAG}`,
			);
		}
		if (pairs.has(definition.migrationTag)) {
			throw new Error(`duplicate pair for ${definition.migrationTag}`);
		}
		const assertion = getDataMigrationAssertion(key, definition.version);
		if (normalize(files[index]?.sql[0] ?? "") !== normalize(assertion)) {
			throw new Error(
				`missing or mismatched data migration assertion in ${definition.migrationTag}`,
			);
		}
		pairs.set(definition.migrationTag, definition);
	}
	for (const file of files) {
		if (file.tag === BOOTSTRAP_MIGRATION_TAG) {
			continue;
		}
		const assertions = file.sql.filter((statement) =>
			/\bIF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.data_migrations\b/i.test(
				statement,
			),
		);
		if (
			assertions.length > 0 &&
			(!pairs.has(file.tag) || assertions.length !== 1)
		) {
			throw new Error(`missing or ambiguous implementation for ${file.tag}`);
		}
	}
	return pairs;
}
