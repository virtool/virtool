import type { SseDomain } from "@virtool/contracts";

/** Postgres channel shared with the upstream Python service for resource-change events. */
export const CLIENT_EVENTS_CHANNEL = "client_events";

/** Resource-change operation as published on the `client_events` channel. */
export type EventOperation = "create" | "update" | "delete";

/**
 * Primary-key type for each domain that may appear on the channel.
 *
 * `roles` is the only one keyed by a string — an administrator role name. Every
 * other domain is keyed by a Postgres integer primary key, and must stay that
 * way: the client parses each frame against `SseMessageSchema`, so a domain
 * typed here as a string that Python emits as a number has every one of its
 * frames rejected, silently dropping the cache invalidation it carried.
 */
export type ResourceId<D extends SseDomain> = D extends "roles"
	? string
	: number;

/** Payload shape published on the `client_events` channel by both Python and Node emitters. */
export type ClientEvent = {
	domain: SseDomain;
	resource_id: number | string;
	operation: EventOperation;
};
