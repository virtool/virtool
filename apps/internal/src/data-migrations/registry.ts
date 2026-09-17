import { legacyIdentities } from "./bodies/legacy-identities";
import type { DataMigrationRegistry } from "./define";

/** Registered data migrations, indexed by their stable key. */
export const DATA_MIGRATIONS: DataMigrationRegistry = {
	[legacyIdentities.key]: legacyIdentities,
};
