import type { Db } from "@virtool/data/db/pg";
import type { StorageBackend } from "@virtool/storage";
import type { TaskRegistry } from "../framework/define";

/**
 * What every task handler is given as `ctx`.
 *
 * The handles a body needs and cannot construct: it is handed a database and
 * object storage the way a `data.ts` function is. Its logger, its payload and
 * its `taskId` arrive on `TaskHandlerArgs` instead.
 */
export type TaskContext = {
	db: Db;
	storage: StorageBackend;
};

/**
 * Every task type this process claims and runs.
 *
 * Empty until the bodies are ported. The runner hands these keys to
 * `acquireTask` as its allowed-types filter, so an empty registry claims nothing
 * rather than claiming work it has no handler for.
 */
export const taskRegistry: TaskRegistry<TaskContext> = {};
