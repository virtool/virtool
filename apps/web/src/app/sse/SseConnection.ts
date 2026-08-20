import { endSession } from "@app/session";
import * as Sentry from "@sentry/tanstackstart-react";
import type { QueryClient } from "@tanstack/react-query";
import { SseMessageSchema } from "@virtool/contracts";
import { reactQueryHandler } from "./reactQueryHandler";

type ConnectionStatus =
	| "initializing"
	| "connecting"
	| "connected"
	| "abandoned"
	| "reconnecting";

let connection: EventSource | null = null;
let connectionStatus: ConnectionStatus = "initializing";
let interval = 500;
let handleMessage: ((data: unknown) => void) | null = null;
let client: QueryClient | null = null;
let hasConnected = false;

export function init(queryClient: QueryClient): void {
	if (handleMessage) {
		return;
	}

	client = queryClient;
	const handler = reactQueryHandler(queryClient);
	handleMessage = (data) => {
		const parsed = SseMessageSchema.safeParse(data);
		if (parsed.success) {
			handler(parsed.data);
			return;
		}

		// One publisher, typed to the same enum this validates against: nothing can
		// legitimately arrive that fails to parse, so every failure is drift worth
		// reporting.
		Sentry.captureException(parsed.error, {
			tags: { sse: "message-validation" },
		});
	};
}

const MAX_INTERVAL = 15000;

function scheduleReconnect(): void {
	if (interval < MAX_INTERVAL) {
		interval += 500;
	}

	setTimeout(() => {
		establishConnection();
	}, interval);
}

/**
 * Decide what to do about a connection the browser refused to retry.
 *
 * A closed `EventSource` means the server answered with something that was not
 * a 200 event-stream, but the `error` event carries no status — a revoked
 * session and a proxy 502 mid-deploy look identical. Ask which it was rather
 * than guess: signing the user out on a deploy would be worse than a slow
 * reconnect.
 */
async function handleRejectedConnection(): Promise<void> {
	let status: number;

	try {
		const response = await window.fetch("/events", { method: "HEAD" });
		status = response.status;
	} catch {
		// The probe never landed, so it says nothing about the session.
		scheduleReconnect();
		return;
	}

	// A connection was re-established while the probe was in flight.
	if (connectionStatus !== "reconnecting") {
		return;
	}

	if (status === 401) {
		connectionStatus = "abandoned";
		endSession();
		return;
	}

	scheduleReconnect();
}

export function establishConnection(): void {
	if (!handleMessage) {
		throw new Error("SSE not initialized. Call init(queryClient) first.");
	}

	// Abandoning is terminal. The session is over and the user is on their way
	// to the login wall; reconnecting would only 401 again.
	if (connectionStatus === "abandoned") {
		return;
	}

	if (connectionStatus === "connecting" || connectionStatus === "connected") {
		return;
	}

	connection?.close();

	connection = new window.EventSource("/events");
	connectionStatus = "connecting";

	connection.onopen = () => {
		interval = 500;
		connectionStatus = "connected";

		// A reconnect means the stream was down for a while, and any invalidation
		// frames NOTIFYed during the gap — including a server-side queue overflow
		// that dropped its backlog — never arrived. Refetch active queries so the
		// client re-syncs. The first connect needs none of this: the route loaders
		// have just populated the cache.
		if (hasConnected) {
			client?.invalidateQueries();
		}
		hasConnected = true;
	};

	connection.onmessage = (e) => {
		try {
			handleMessage?.(JSON.parse(e.data));
		} catch (error) {
			Sentry.captureException(error, { tags: { sse: "message-parse" } });
		}
	};

	connection.onerror = () => {
		// Read `readyState` before closing — `close()` forces it to CLOSED and
		// destroys the only signal the platform gives us. CLOSED here means the
		// browser gave up on a response it considered fatal and will not retry on
		// its own. Anything else is a dropped transport, which it would retry.
		const rejected = connection?.readyState === window.EventSource.CLOSED;

		connection?.close();
		connection = null;
		connectionStatus = "reconnecting";

		if (rejected) {
			void handleRejectedConnection();
			return;
		}

		scheduleReconnect();
	};
}

export function getConnectionStatus(): ConnectionStatus {
	return connectionStatus;
}
