import {
	CACHE_STORAGE_BUDGET_BYTES,
	evictLruCaches,
} from "@virtool/data/caches/data";
import { z } from "zod";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `evict_caches_lru` is spawned on a schedule and carries nothing.
 *
 * `z.object` strips unknown keys rather than rejecting them, which is what is
 * wanted here: a row Python wrote carrying a key this side does not read still
 * runs. `z.strictObject` would fail the task on that key, and the body reads no
 * key at all.
 */
const payload = z.object({});

/**
 * Evict least-recently-used caches until the store is back under budget.
 *
 * The port of Python's `LRUCacheEvictionTask`, whose body is likewise one call.
 * Everything it runs is `evictLruCaches`: select the LRU rows whose removal
 * brings the store under {@link CACHE_STORAGE_BUDGET_BYTES}, delete their
 * objects, then delete the rows.
 *
 * It is idempotent as a reclaim requires. A re-run selects whatever is still
 * over budget — nothing, if the first attempt committed — and every storage
 * delete it makes is idempotent on its own, so a run that was interrupted
 * part-way through its objects is finished by the next one rather than
 * repaired by it.
 *
 * It reports no progress inside the step. The candidate count is not known
 * until the select returns and the deletes that follow are a handful of round
 * trips, so there is no position worth publishing and the bar moves 0 → 100 on
 * the framework's step entry and completion writes alone.
 *
 * The run's signal is forwarded. The storage backend takes none, so it is
 * checked between deletes, which is what keeps a run holding hundreds of
 * objects from outliving the drain and deleting rows on behalf of a runner that
 * has already released the claim.
 */
export const evictCachesLruTask = defineTask<typeof payload, TaskContext>({
	type: "evict_caches_lru",
	payload,
	// Python names its step after the bound method it runs, `BaseTask.run`
	// writing `func.__name__` into the column. Both runners write `evict` for the
	// same work until the cutover completes.
	steps: ["evict"],
	async run({ ctx, helpers, logger, signal }) {
		await helpers.runStep("evict", async () => {
			await evictLruCaches(
				ctx.db,
				ctx.storage,
				logger,
				CACHE_STORAGE_BUDGET_BYTES,
				signal,
			);
		});
	},
});
