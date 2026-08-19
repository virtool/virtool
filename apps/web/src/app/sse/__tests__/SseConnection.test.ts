import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const endSession = vi.fn();

vi.mock("@app/session", () => ({
	armSessionEnd: vi.fn(),
	endSession,
}));

const handler = vi.fn();

vi.mock("../reactQueryHandler", () => ({
	reactQueryHandler: () => handler,
}));

const captureException = vi.fn();

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException,
}));

/**
 * The two ways a connection dies, as the platform reports them. The browser
 * hands the application a bare `error` event either way — `readyState` is the
 * only thing that separates them.
 */
class FakeEventSource {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;

	static instances: FakeEventSource[] = [];

	readyState: number = FakeEventSource.CONNECTING;
	onopen: (() => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(readonly url: string) {
		FakeEventSource.instances.push(this);
	}

	addEventListener() {}

	close() {
		this.readyState = FakeEventSource.CLOSED;
	}

	/** The server accepted the stream. */
	open() {
		this.readyState = FakeEventSource.OPEN;
		this.onopen?.();
	}

	/** The server answered with something fatal. The browser will not retry. */
	reject() {
		this.readyState = FakeEventSource.CLOSED;
		this.onerror?.();
	}

	/** The transport dropped. The browser would retry this on its own. */
	drop() {
		this.readyState = FakeEventSource.CONNECTING;
		this.onerror?.();
	}

	/** The server pushed a `data:` frame, as the browser delivers it. */
	message(frame: unknown) {
		this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
	}
}

const fetchMock = vi.fn();
const invalidateQueries = vi.fn();

async function establish() {
	vi.resetModules();
	const sse = await import("../SseConnection");
	sse.init({ invalidateQueries } as unknown as QueryClient);
	sse.establishConnection();

	return sse;
}

function openConnection(): FakeEventSource {
	const [connection] = FakeEventSource.instances;
	if (!connection) {
		throw new Error("no connection was opened");
	}

	return connection;
}

describe("SseConnection", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		FakeEventSource.instances = [];
		endSession.mockClear();
		handler.mockClear();
		captureException.mockClear();
		invalidateQueries.mockClear();
		fetchMock.mockReset();
		vi.stubGlobal("EventSource", FakeEventSource);
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("reconnects when the transport drops", async () => {
		const sse = await establish();

		openConnection().drop();
		expect(sse.getConnectionStatus()).toBe("reconnecting");

		await vi.advanceTimersByTimeAsync(1000);

		expect(FakeEventSource.instances).toHaveLength(2);
		// Nothing about a dropped transport suggests the session is gone, so it is
		// not worth asking.
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refetches active queries on reconnect but not on the first connect", async () => {
		await establish();

		openConnection().open();
		expect(invalidateQueries).not.toHaveBeenCalled();

		openConnection().drop();
		await vi.advanceTimersByTimeAsync(1000);

		const second = FakeEventSource.instances[1];
		if (!second) {
			throw new Error("no reconnect was opened");
		}
		second.open();
		expect(invalidateQueries).toHaveBeenCalledTimes(1);
	});

	it("abandons the stream and ends the session when the handshake is unauthorized", async () => {
		fetchMock.mockResolvedValue({ status: 401 });
		const sse = await establish();

		openConnection().reject();
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchMock).toHaveBeenCalledWith("/events", { method: "HEAD" });
		expect(sse.getConnectionStatus()).toBe("abandoned");
		expect(endSession).toHaveBeenCalledTimes(1);
	});

	it("never reconnects once it has abandoned the stream", async () => {
		fetchMock.mockResolvedValue({ status: 401 });
		const sse = await establish();

		openConnection().reject();
		await vi.advanceTimersByTimeAsync(0);

		// The reconnect loop this replaces would have opened a connection every
		// 15 seconds, forever, and looked up the session in Postgres each time.
		await vi.advanceTimersByTimeAsync(120_000);
		sse.establishConnection();

		expect(FakeEventSource.instances).toHaveLength(1);
	});

	it("keeps reconnecting when the server is failing rather than rejecting", async () => {
		fetchMock.mockResolvedValue({ status: 503 });
		const sse = await establish();

		openConnection().reject();
		await vi.advanceTimersByTimeAsync(0);

		// A bad gateway during a deploy closes the stream exactly like a revoked
		// session does. Signing the user out here would be the worse bug.
		expect(endSession).not.toHaveBeenCalled();
		expect(sse.getConnectionStatus()).toBe("reconnecting");

		await vi.advanceTimersByTimeAsync(1000);

		expect(FakeEventSource.instances).toHaveLength(2);
	});

	it("keeps reconnecting when the probe itself cannot be delivered", async () => {
		fetchMock.mockRejectedValue(new Error("offline"));
		await establish();

		openConnection().reject();
		await vi.advanceTimersByTimeAsync(0);

		expect(endSession).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);

		expect(FakeEventSource.instances).toHaveLength(2);
	});

	it("dispatches a valid frame to the query handler", async () => {
		await establish();

		openConnection().message({ domain: "labels", operation: "update", id: 4 });

		expect(handler).toHaveBeenCalledWith({
			domain: "labels",
			operation: "update",
			id: 4,
		});
		expect(captureException).not.toHaveBeenCalled();
	});

	it("reports a malformed frame for a domain it does handle", async () => {
		await establish();

		// `labels` is a number-id domain, so a string id is real contract drift.
		openConnection().message({
			domain: "labels",
			operation: "update",
			id: "not-a-number",
		});

		expect(handler).not.toHaveBeenCalled();
		expect(captureException).toHaveBeenCalledTimes(1);
	});
});
