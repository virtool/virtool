/**
 * Which database operations each Drizzle migration requires.
 *
 * A migration listed here is not applied — and neither is any migration after
 * it — until every operation it names has passed at the version this image
 * declares. The runner stops at the first unsatisfied migration and exits
 * non-zero, so a deploy that would have applied a schema change over data
 * nobody checked fails instead.
 *
 * Only migrations after {@link BOOTSTRAP_MIGRATION_TAG} may appear. The tables
 * a gate is evaluated against are created by that migration, so a gate at or
 * before it could never be satisfied. The runner checks this at startup rather
 * than discovering it mid-deploy.
 *
 * ```ts
 * export const MIGRATION_GATES: MigrationGates = {
 *   "0031_drop_legacy_password": ["audit_legacy_identities"],
 * };
 * ```
 */
export type MigrationGates = Record<string, readonly string[]>;

/**
 * The migration that creates `database_operations` and its findings table.
 *
 * Named here so the ordering rule above is enforced against something rather
 * than remembered.
 */
export const BOOTSTRAP_MIGRATION_TAG = "0023_add_database_operations";

/** The gate declarations. See {@link MigrationGates}. */
export const MIGRATION_GATES: MigrationGates = {};
