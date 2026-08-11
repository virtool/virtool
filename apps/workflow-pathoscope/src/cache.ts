import {
	createWorkflowCache,
	type WorkflowCache,
	type WorkflowContext,
} from "@virtool/workflow";
import type { PathoscopeData } from "./context";
import { workPaths } from "./paths";
import type { PathoscopeState } from "./state";

/**
 * The run's cache, built from the handles already on its context.
 *
 * Made where it is used rather than threaded through the workflow definition:
 * it is a plain object over the run's jobs API client and storage backend, both
 * of which the context carries, and building it at definition time would mean
 * constructing the workflow after the claim.
 *
 * Archives are staged under the work path, not the OS temp directory — a mapping
 * index runs to gigabytes and the work path is the only volume a pod is sized
 * for.
 */
export function cacheFor(
	context: WorkflowContext<PathoscopeData, PathoscopeState>,
): WorkflowCache {
	return createWorkflowCache({
		client: context.client,
		storage: context.storage,
		stagingPath: workPaths(context.workPath).cacheStaging,
	});
}
