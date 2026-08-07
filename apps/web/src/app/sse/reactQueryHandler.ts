import { accountQueryKeys } from "@account/keys";
import { roleQueryKeys } from "@administration/keys";
import { analysesQueryKeys } from "@analyses/keys";
import type { QueryKeys } from "@app/queryKeys";
import { bannerQueryKeys } from "@banner/keys";
import { groupQueryKeys } from "@groups/keys";
import { indexQueryKeys } from "@indexes/keys";
import { jobQueryKeys } from "@jobs/keys";
import { createJobRefreshQueue } from "@jobs/refresh";
import { labelQueryKeys } from "@labels/keys";
import { referenceQueryKeys } from "@references/keys";
import { samplesQueryKeys } from "@samples/keys";
import { subtractionQueryKeys } from "@subtraction/keys";
import type { QueryClient } from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";
import { createTaskRefreshQueue } from "@tasks/refresh";
import { fileQueryKeys } from "@uploads/keys";
import { userQueryKeys } from "@users/keys";
import type { SseDomain, SseMessage } from "@virtool/contracts";

/**
 * What a domain caches, and therefore how narrowly its frames can be
 * invalidated.
 *
 * Every domain has the full set of keys, but not every domain caches a record
 * at `detail(id)` or a collection under `lists()`. Invalidating a key nothing
 * is cached under is a silent no-op, so a domain that caches neither has to
 * fall back to `all()`. This must be declared rather than inferred from the
 * keys: they are always present, so their absence can no longer signal it.
 */
type CachedShapes = {
	keys: QueryKeys;

	/** Whether single records are cached under `detail(id)`. */
	details: boolean;

	/** Whether collections are cached under `lists()`. */
	lists: boolean;

	/**
	 * Whether an `update` must invalidate `all()` rather than the narrower
	 * `detail(id)`/`lists()` key.
	 *
	 * Two domains need this. Banners cache the active banner at `active()`,
	 * under `all()` but not `lists()`, and a non-admin caches nothing else, so
	 * narrowing to `lists()` would never reach it. Analyses cache both a detail
	 * and a per-sample list keyed by `list([sampleId, …])`; an update — an
	 * analysis flipping to `ready` — changes the list row, but the frame carries
	 * only the analysis id, not the `sampleId` the list is keyed by, so it
	 * cannot target one list and refreshes `all()`.
	 */
	updateNeedsAll?: boolean;
};

const domains: Record<SseDomain, CachedShapes> = {
	account: { keys: accountQueryKeys, details: false, lists: false },
	analyses: {
		keys: analysesQueryKeys,
		details: true,
		lists: true,
		updateNeedsAll: true,
	},
	groups: { keys: groupQueryKeys, details: true, lists: true },
	indexes: { keys: indexQueryKeys, details: true, lists: true },
	jobs: { keys: jobQueryKeys, details: true, lists: true },
	labels: { keys: labelQueryKeys, details: false, lists: true },
	messages: {
		keys: bannerQueryKeys,
		details: false,
		lists: true,
		updateNeedsAll: true,
	},
	references: { keys: referenceQueryKeys, details: true, lists: true },
	roles: { keys: roleQueryKeys, details: false, lists: false },
	samples: { keys: samplesQueryKeys, details: true, lists: true },
	subtractions: { keys: subtractionQueryKeys, details: true, lists: true },
	tasks: { keys: taskQueryKeys, details: true, lists: false },
	uploads: { keys: fileQueryKeys, details: false, lists: true },
	users: { keys: userQueryKeys, details: true, lists: true },
};

function selectQueryKey(
	domain: CachedShapes,
	operation: SseMessage["operation"],
	id: SseMessage["id"],
): readonly unknown[] {
	if (operation === "update") {
		if (domain.updateNeedsAll) {
			return domain.keys.all();
		}
		if (domain.details) {
			return domain.keys.detail(id);
		}
		if (domain.lists) {
			return domain.keys.lists();
		}
		return domain.keys.all();
	}
	if ((operation === "insert" || operation === "delete") && domain.lists) {
		return domain.keys.lists();
	}
	return domain.keys.all();
}

export function reactQueryHandler(queryClient: QueryClient) {
	const queueJobRefresh = createJobRefreshQueue(queryClient);
	const queueTaskRefresh = createTaskRefreshQueue(queryClient);

	return (message: SseMessage) => {
		const domain = domains[message.domain];
		if (!domain) {
			return;
		}

		// Jobs and tasks are the two domains where an update frame arrives per
		// running record per progress step, and every one on screen holds its own
		// detail query. Invalidating each one fans out to a request per row, so
		// these frames go through a queue that batches the reads instead.
		if (message.domain === "jobs" && message.operation === "update") {
			queueJobRefresh(message.id);
			return;
		}

		if (message.domain === "tasks" && message.operation === "update") {
			queueTaskRefresh(message.id);
			return;
		}

		queryClient.invalidateQueries({
			queryKey: selectQueryKey(domain, message.operation, message.id),
		});
	};
}
