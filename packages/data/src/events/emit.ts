import type { SseDomain } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import type { PgClient } from "../db/pg";
import {
	CLIENT_EVENTS_CHANNEL,
	type ClientEvent,
	type EventOperation,
	type ResourceId,
} from "./channel";

/** What {@link createEmitter} needs to publish on the shared channel. */
export type EmitterOptions = {
	client: PgClient;
	logger: Logger;
};

/** Publishes one resource-change event on the shared `client_events` channel. */
export type Emit = <D extends SseDomain>(
	domain: D,
	resourceId: ResourceId<D>,
	operation: EventOperation,
) => Promise<void>;

let emitter: Emit | undefined;

/**
 * Build the process-wide client-event emitter and install it behind
 * {@link emit}. Call this once, at a composition root.
 *
 * The module-scoped handle is the deliberate exception to this package's
 * everything-is-an-argument rule. `emit` is called from more than two dozen
 * plain mutations that do not otherwise log or reach the pool directly, and
 * threading a client and a logger through every one of them to keep a single
 * failure line visible is poor value per call site. This is an *explicit*
 * composition call rather than the import-time side effect the extraction
 * exists to remove, and the compromise is confined to this module.
 */
export function createEmitter({ client, logger }: EmitterOptions): Emit {
	async function emitEvent<D extends SseDomain>(
		domain: D,
		resourceId: ResourceId<D>,
		operation: EventOperation,
	): Promise<void> {
		const payload: ClientEvent = {
			domain,
			resource_id: resourceId,
			operation,
		};

		try {
			await client.notify(CLIENT_EVENTS_CHANNEL, JSON.stringify(payload));
			logger.debug({ ...payload }, "emitted client event");
		} catch (err) {
			logger.error({ err, ...payload }, "failed to emit client event");
		}
	}

	emitter = emitEvent;

	return emitEvent;
}

/**
 * Publish a resource-change event on the shared `client_events` channel via
 * Postgres NOTIFY. Mirrors the payload shape emitted by the Python service so
 * a single listener can fan out events from either source.
 */
export async function emit<D extends SseDomain>(
	domain: D,
	resourceId: ResourceId<D>,
	operation: EventOperation,
): Promise<void> {
	if (emitter === undefined) {
		throw new Error(
			"no client event emitter has been created — call createEmitter at startup",
		);
	}

	await emitter(domain, resourceId, operation);
}
