import { invalidateChange, isCachedDomain } from "@app/invalidate";
import { createJobRefreshQueue } from "@jobs/refresh";
import type { QueryClient } from "@tanstack/react-query";
import { createTaskRefreshQueue } from "@tasks/refresh";
import type { SseMessage } from "@virtool/contracts";

export function reactQueryHandler(queryClient: QueryClient) {
	const queueJobRefresh = createJobRefreshQueue(queryClient);
	const queueTaskRefresh = createTaskRefreshQueue(queryClient);

	return (message: SseMessage) => {
		if (!isCachedDomain(message.domain)) {
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

		invalidateChange(queryClient, message);
	};
}
