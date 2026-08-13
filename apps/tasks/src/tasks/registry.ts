import type { Db } from "@virtool/data/db/pg";
import type { StorageBackend } from "@virtool/storage";
import type { TaskRegistry } from "../framework/define";
import { cleanupSessionsTask } from "./cleanup-sessions";
import { createIndexTask } from "./create-index";
import { evictCachesLruTask } from "./evict-caches-lru";
import { installHmmsTask } from "./install-hmms";
import { reapOrphanedUploadsTask } from "./reap-orphaned-uploads";
import { refreshHmmsTask } from "./refresh-hmms";
import { timeoutJobsTask } from "./timeout-jobs";

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
 * The keys are the runner's allowed-types filter, handed to `acquireTask`. That
 * is the whole of how an unrecognised `tasks.type` is rejected: a row naming a
 * task absent from here is never claimed, so it stays queued for the Python
 * runner that does know it. Nothing validates the column, and nothing needs to
 * — the filter is the registry, so the two cannot disagree.
 *
 * Written as a literal map rather than derived from each body's `type`, so the
 * set of names this process claims is greppable in one place. A key that
 * disagrees with its body's `type` would claim under one name and dispatch
 * another; `registry.test.ts` fails on any that do.
 */
export const taskRegistry: TaskRegistry<TaskContext> = {
	cleanup_sessions: cleanupSessionsTask,
	create_index: createIndexTask,
	evict_caches_lru: evictCachesLruTask,
	install_hmms: installHmmsTask,
	reap_orphaned_uploads: reapOrphanedUploadsTask,
	refresh_hmms: refreshHmmsTask,
	timeout_jobs: timeoutJobsTask,
};
