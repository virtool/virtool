import type { JobNested as EmbeddedJob } from "@virtool/contracts";
import type { ServerJobNested } from "./types";

/**
 * Adapt a resource's embedded job to the snake_case shape this feature's schema
 * parses. Resources served from the TypeScript server carry a camelCase job,
 * but the jobs feature is still served from the Python API, so its
 * `useFetchJob` seed and `JobNestedSchema` expect the snake_case one.
 */
export function toServerJobNested(job: EmbeddedJob): ServerJobNested {
	return {
		created_at: job.createdAt,
		id: job.id,
		progress: job.progress,
		state: job.state,
		user: job.user,
		workflow: job.workflow,
	};
}
