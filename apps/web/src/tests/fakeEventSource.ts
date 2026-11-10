// The SSE bridge constructs an EventSource when the authenticated layout mounts.
// jsdom has no EventSource, and in a real browser it would connect to a server
// that does not exist. A noop stand-in keeps the connection inert. The
// readyState constants are part of the surface: SseConnection reads
// `window.EventSource.CLOSED` to tell a rejected handshake from a dropped
// transport.
class FakeEventSource {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;

	readyState: number = FakeEventSource.CONNECTING;

	close() {
		this.readyState = FakeEventSource.CLOSED;
	}
	addEventListener() {}
	removeEventListener() {}
	dispatchEvent() {
		return true;
	}
	onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
	onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
	onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
}
// @ts-expect-error FakeEventSource only implements the surface SseConnection touches.
window.EventSource = FakeEventSource;
