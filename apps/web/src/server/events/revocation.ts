import { requireAuthenticatedRequest } from "../auth/middleware";
import { logger } from "../logger";

/**
 * Watch the session behind an open SSE connection and call `onRevoked` once it
 * stops verifying.
 *
 * The stream is authenticated once, at the handshake. Without this, a session
 * that stops verifying underneath a connected client would leave the stream up
 * until the client happened to reconnect.
 *
 * This is exactly as sharp as the gate it runs, and no sharper: it catches a
 * deleted session row — including one deleted by an admin-initiated
 * deactivation, password change, and a deactivated user.
 *
 * Returns a function that stops the watch. It is safe to call more than once.
 */
export function watchForRevocation(
	request: Request,
	intervalMs: number,
	onRevoked: () => void,
): () => void {
	let timer: ReturnType<typeof setInterval> | null = setInterval(
		check,
		intervalMs,
	);
	let checking = false;

	function stop(): void {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function check(): void {
		// A check outlives its interval when the database is slow, so ticks would
		// otherwise pile up and each report the same revocation. Run at most one at
		// a time, and ignore a result that lands after the watch has stopped.
		if (checking || timer === null) {
			return;
		}

		checking = true;

		void requireAuthenticatedRequest(request)
			.then((gate) => {
				if (timer !== null && gate instanceof Response) {
					stop();
					onRevoked();
				}
			})
			.catch((err) => {
				// A lookup that failed is not proof of a session that is gone. Leave
				// the stream up and try again on the next tick.
				logger.warn({ err }, "sse session revocation check failed");
			})
			.finally(() => {
				checking = false;
			});
	}

	return stop;
}
