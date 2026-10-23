import { toast } from "@base/Toast/useToast";
import type { Query, QueryClient } from "@tanstack/react-query";
import { UNAVAILABLE_MESSAGE } from "@virtool/contracts";
import { isServiceUnavailable } from "./queryErrors";

/** How often queries a 503 failed are refetched, matching `retry-after`. */
const OUTAGE_REFETCH_MS = 5000;

function isOutageQuery(query: Query): boolean {
	return (
		query.state.status === "error" && isServiceUnavailable(query.state.error)
	);
}

/**
 * Create the recovery loop for queries that failed because Virtool was
 * temporarily unavailable.
 *
 * Call the returned function when a query fails with a 503. Every five seconds
 * it refetches each mounted query that a 503 failed, until none remain, so
 * inline errors clear on their own once the service is back. Queries are not
 * retried on a 503, so nothing else brings them back. Route-level failures
 * recover through `RouteError` instead, because their observers are unmounted.
 */
export function createOutageRecovery(queryClient: QueryClient): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;

	function schedule(): void {
		if (timer !== undefined) {
			return;
		}

		timer = setTimeout(async () => {
			await queryClient.refetchQueries({
				type: "active",
				predicate: isOutageQuery,
			});

			timer = undefined;

			const remaining = queryClient
				.getQueryCache()
				.findAll({ type: "active", predicate: isOutageQuery });

			if (remaining.length > 0) {
				schedule();
			}
		}, OUTAGE_REFETCH_MS);
	}

	return schedule;
}

let outageToast: ReturnType<typeof toast> | null = null;

/**
 * Tell the user that an action failed because Virtool was temporarily
 * unavailable.
 *
 * Many actions show no error of their own, so without this an outage leaves
 * them failing in silence. A new notice replaces the last one, so repeated
 * failures do not stack.
 */
export function notifyOutage(): void {
	outageToast?.dismiss();
	outageToast = toast({ description: UNAVAILABLE_MESSAGE });
}
