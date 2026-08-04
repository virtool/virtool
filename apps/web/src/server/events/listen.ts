import {
	CLIENT_EVENTS_CHANNEL,
	type ClientEvent,
} from "@virtool/data/events/channel";
import { client } from "../composition";
import { logger } from "../logger";

/**
 * Cap on events buffered for a consumer that has fallen behind. On overflow the
 * stream is dropped rather than buffered without bound: the client reconnects
 * and refetches, which re-syncs it far more cheaply than draining a giant
 * backlog of stale invalidations would.
 */
const MAX_QUEUE = 1000;

/** Stream of client events plus a cleanup hook to unlisten and close. */
export type ClientEventStream = {
	events: AsyncIterable<ClientEvent>;
	close: () => Promise<void>;
};

/**
 * Subscribe to `client_events` and yield parsed payloads. postgres-js manages a
 * dedicated subscriber connection internally, so the shared Drizzle pool is
 * unaffected. Call `close()` to unlisten and drain.
 */
export function listenForClientEvents(): ClientEventStream {
	const queue: ClientEvent[] = [];
	let resolveNext: ((value: IteratorResult<ClientEvent>) => void) | null = null;
	let closed = false;

	function push(event: ClientEvent) {
		if (resolveNext) {
			const r = resolveNext;
			resolveNext = null;
			r({ value: event, done: false });
			return;
		}

		if (queue.length >= MAX_QUEUE) {
			logger.warn(
				{ max: MAX_QUEUE },
				"sse client event queue overflowed; dropping connection",
			);
			closed = true;
			queue.length = 0;
			finish();
			return;
		}

		queue.push(event);
	}

	function finish() {
		if (resolveNext) {
			const r = resolveNext;
			resolveNext = null;
			r({ value: undefined, done: true });
		}
	}

	const listenPromise = client.listen(CLIENT_EVENTS_CHANNEL, (payload) => {
		if (closed) {
			return;
		}
		try {
			const parsed = JSON.parse(payload) as ClientEvent;
			push(parsed);
		} catch (err) {
			logger.warn({ err, payload }, "failed to parse client event payload");
		}
	});

	const events: AsyncIterable<ClientEvent> = {
		[Symbol.asyncIterator]() {
			return {
				next(): Promise<IteratorResult<ClientEvent>> {
					if (queue.length > 0) {
						return Promise.resolve({
							value: queue.shift() as ClientEvent,
							done: false,
						});
					}
					if (closed) {
						return Promise.resolve({ value: undefined, done: true });
					}
					return new Promise((resolve) => {
						resolveNext = resolve;
					});
				},
				return(): Promise<IteratorResult<ClientEvent>> {
					closed = true;
					finish();
					return Promise.resolve({ value: undefined, done: true });
				},
			};
		},
	};

	async function close(): Promise<void> {
		closed = true;
		finish();
		try {
			const meta = await listenPromise;
			await meta.unlisten();
		} catch (err) {
			logger.warn({ err }, "failed to unlisten from client_events");
		}
	}

	return { events, close };
}
