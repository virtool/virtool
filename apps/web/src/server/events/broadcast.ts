import type { SseMessage } from "@virtool/contracts";
import type { ClientEvent } from "@virtool/data/events/channel";

/**
 * Convert a Postgres-published client event into the id-only message shape
 * browser clients consume. The client refetches via the normal REST API on
 * invalidation, so the server does no resource resolution here.
 *
 * The wire schema enforces per-domain id types at the client parse boundary;
 * we forward the resource id as-is and let SseMessageSchema reject mismatches.
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
