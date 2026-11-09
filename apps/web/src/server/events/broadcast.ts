import type { SseMessage } from "@virtool/contracts";
import type { ClientEvent } from "@virtool/data/events/channel";

/**
 * Check whether a client event may go to a stream opened by the given user.
 *
 * An `account` event concerns only the user it names. The client refreshes its
 * whole account cache for any `account` frame, so sending one to every stream
 * would make every signed-in browser refetch its account.
 *
 * Other events go to every stream without a read-rights check. A message holds
 * only a domain, an operation, and an id, and gives no access to the record:
 * the client refetches through server functions that check read rights. A
 * rights lookup for each event would add cost to every delivery for almost no
 * gain.
 */
export function isEventForUser(event: ClientEvent, userId: number): boolean {
	return event.domain !== "account" || event.resource_id === userId;
}

/**
 * Convert a Postgres-published client event into the id-only message shape
 * browser clients consume. The client refetches via the normal REST API on
 * invalidation, so the server does no resource resolution here.
 *
 * The wire schema enforces per-domain id types at the client parse boundary;
 * the resource id is forwarded as-is and SseMessageSchema rejects mismatches.
 */
export function eventToSseMessage(event: ClientEvent): SseMessage {
	const operation =
		event.operation === "create"
			? "insert"
			: event.operation === "update"
				? "update"
				: "delete";

	return {
		domain: event.domain,
		operation,
		id: event.resource_id,
	} as SseMessage;
}
