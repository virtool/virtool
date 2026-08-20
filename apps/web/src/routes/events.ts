import { requireAuthenticatedRequest } from "@server/auth/middleware";
import { eventToSseMessage } from "@server/events/broadcast";
import { listenForClientEvents } from "@server/events/listen";
import { watchForRevocation } from "@server/events/revocation";
import { logger } from "@server/logger";
import { createFileRoute } from "@tanstack/react-router";

const KEEPALIVE_MS = 25_000;

/**
 * Answer the client's probe for why its stream was rejected.
 *
 * The `error` event on an `EventSource` carries no status code, so a client
 * whose connection the browser gave up on cannot tell a revoked session (401)
 * from a proxy 502 during a deploy. This runs the same gate as the stream and
 * reports the status without opening one.
 */
async function handleEventsProbe({
	request,
}: {
	request: Request;
}): Promise<Response> {
	const gate = await requireAuthenticatedRequest(request);

	// A HEAD response carries no body, so answer with the status alone.
	return new Response(null, {
		status: gate instanceof Response ? gate.status : 204,
	});
}

async function handleEvents({
	request,
}: {
	request: Request;
}): Promise<Response> {
	const gate = await requireAuthenticatedRequest(request);
	if (gate instanceof Response) {
		return gate;
	}

	const encoder = new TextEncoder();
	const stream = listenForClientEvents();

	let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
	let stopRevocationWatch: (() => void) | null = null;
	let aborted = false;

	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			function send(chunk: string) {
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					// controller already closed
				}
			}

			send(`: connected\n\n`);

			keepaliveTimer = setInterval(() => {
				send(`: keepalive\n\n`);
			}, KEEPALIVE_MS);

			const onAbort = async () => {
				if (aborted) {
					return;
				}
				aborted = true;
				if (keepaliveTimer) {
					clearInterval(keepaliveTimer);
					keepaliveTimer = null;
				}
				stopRevocationWatch?.();
				stopRevocationWatch = null;
				await stream.close();
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			request.signal.addEventListener("abort", () => {
				void onAbort();
			});

			// Closing the stream is the whole revocation signal. The client
			// reconnects, the handshake above answers 401, and it ends the session
			// from there — one path, rather than a second in-stream frame type.
			stopRevocationWatch = watchForRevocation(request, KEEPALIVE_MS, () => {
				void onAbort();
			});

			try {
				for await (const event of stream.events) {
					if (aborted) {
						break;
					}

					try {
						const message = eventToSseMessage(event);
						send(`data: ${JSON.stringify(message)}\n\n`);
					} catch (err) {
						logger.warn({ err, event }, "failed to deliver sse message");
					}
				}
			} catch (err) {
				logger.warn({ err }, "sse client event stream errored");
			} finally {
				await onAbort();
			}
		},
		async cancel() {
			aborted = true;
			if (keepaliveTimer) {
				clearInterval(keepaliveTimer);
				keepaliveTimer = null;
			}
			stopRevocationWatch?.();
			stopRevocationWatch = null;
			await stream.close();
		},
	});

	return new Response(body, {
		headers: {
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"Content-Type": "text/event-stream",
			"X-Accel-Buffering": "no",
		},
	});
}

export const Route = createFileRoute("/events")({
	server: {
		handlers: {
			GET: handleEvents,
			HEAD: handleEventsProbe,
		},
	},
});
