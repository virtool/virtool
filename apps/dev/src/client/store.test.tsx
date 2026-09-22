// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSnapshot } from "./store.ts";

class TestEventSource extends EventTarget {
	static instances: TestEventSource[] = [];
	onerror: (() => void) | null = null;
	close = vi.fn();
	constructor(public url: string) {
		super();
		TestEventSource.instances.push(this);
	}
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	TestEventSource.instances = [];
});

it("retains the snapshot during disconnects and waits for fresh state before going live", () => {
	vi.stubGlobal("EventSource", TestEventSource);
	const { result, unmount } = renderHook(useSnapshot);
	const source = TestEventSource.instances[0];
	if (!source) {
		throw new Error("Missing event source");
	}
	expect(source.url).toBe("/api/events");
	expect(result.current.connection).toBe("connecting");
	const snapshot = { ...result.current.snapshot, updatedAt: 123 };
	act(() => {
		source.dispatchEvent(
			new MessageEvent("state", { data: JSON.stringify(snapshot) }),
		);
	});
	expect(result.current.connection).toBe("live");
	act(() => {
		source.onerror?.();
	});
	expect(result.current.connection).toBe("reconnecting");
	expect(result.current.snapshot.updatedAt).toBe(123);
	expect(source.close).not.toHaveBeenCalled();
	act(() => {
		source.dispatchEvent(
			new MessageEvent("state", {
				data: JSON.stringify({ ...snapshot, updatedAt: 456 }),
			}),
		);
	});
	expect(result.current.connection).toBe("live");
	expect(result.current.snapshot.updatedAt).toBe(456);
	unmount();
	expect(source.close).toHaveBeenCalledOnce();
});
