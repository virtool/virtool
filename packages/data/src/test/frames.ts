import type { PgClient } from "../db/pg";
import { CLIENT_EVENTS_CHANNEL, type ClientEvent } from "../events/channel";

/**
 * Collect the `client_events` frames published while `run` executes.
 *
 * The sentinel published at the end is what makes a count sound: it goes over
 * the same connection the emitter uses, after everything `run` did, so its
 * arrival proves every frame `run` published has already been received. Waiting
 * a fixed interval instead passes on a slow machine for the wrong reason, and a
 * row that changed is not evidence a frame went out.
 *
 * `roles` is the sentinel's domain because it is the one domain keyed by a
 * string, so a sentinel cannot be mistaken for a real frame about a task.
 */
export async function collectFrames(
	client: PgClient,
	run: () => Promise<void>,
): Promise<ClientEvent[]> {
	const received: ClientEvent[] = [];

	let seal: () => void = () => undefined;

	const sealed = new Promise<void>((resolve) => {
		seal = resolve;
	});

	const subscription = await client.listen(CLIENT_EVENTS_CHANNEL, (payload) => {
		const event = JSON.parse(payload) as ClientEvent;

		if (event.domain === "roles" && event.resource_id === "sentinel") {
			seal();
			return;
		}

		received.push(event);
	});

	try {
		await run();

		await client.notify(
			CLIENT_EVENTS_CHANNEL,
			JSON.stringify({
				domain: "roles",
				resource_id: "sentinel",
				operation: "update",
			}),
		);

		await sealed;
	} finally {
		await subscription.unlisten();
	}

	return received;
}
