import { currentIsolateSegments } from "./bodies/current-isolate-segments";
import { legacyIdentities } from "./bodies/legacy-identities";
import { primaryGroupUniqueness } from "./bodies/primary-group-uniqueness";
import type { DataMigrationRegistry } from "./define";

/** Registered data migrations, indexed by their stable key. */
export const DATA_MIGRATIONS: DataMigrationRegistry = {
	[currentIsolateSegments.key]: currentIsolateSegments,
	[legacyIdentities.key]: legacyIdentities,
	[primaryGroupUniqueness.key]: primaryGroupUniqueness,
};
