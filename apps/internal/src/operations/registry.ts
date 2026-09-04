import type { OperationRegistry } from "./define";

/**
 * Every database operation this image can run, keyed by its stable key.
 *
 * A key here is the same string a migration names in `MIGRATION_GATES`, and an
 * operation is only ever removed from this registry once no migration still
 * requires it — a gate naming a key the registry has lost blocks every
 * migration from that point on, which is the correct outcome but a confusing
 * one to meet during a deploy.
 *
 * Empty until the first operation lands. The framework is exercised through
 * fixtures rather than through whatever happens to be registered.
 */
export const OPERATIONS: OperationRegistry = {};
