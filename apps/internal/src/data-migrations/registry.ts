import { legacyIdentities } from "./bodies/legacy-identities";
import { primaryGroupUniqueness } from "./bodies/primary-group-uniqueness";
import { sampleNameUniqueness } from "./bodies/sample-name-uniqueness";
import type { DataMigrationRegistry } from "./define";

/** Registered data migrations, indexed by their stable key. */
export const DATA_MIGRATIONS: DataMigrationRegistry = {
	[legacyIdentities.key]: legacyIdentities,
	[primaryGroupUniqueness.key]: primaryGroupUniqueness,
	[sampleNameUniqueness.key]: sampleNameUniqueness,
};
