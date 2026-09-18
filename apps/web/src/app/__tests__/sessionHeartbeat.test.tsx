import { useBrowserSessionHeartbeat } from "@app/sessionHeartbeat";
import { act, renderHook } from "@testing-library/react";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setVisibility(state: DocumentVisibilityState) {
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		value: state,
	});
	document.dispatchEvent(new Event("visibilitychange"));
}

describe("useBrowserSessionHeartbeat()", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setVisibility("visible");
		authServerFnMocks.heartbeatBrowserSessionFn.mockResolvedValue({
			nextHeartbeatInMilliseconds: 1_000,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("heartbeats immediately and at the server-provided interval", async () => {
		renderHook(() => useBrowserSessionHeartbeat(true));
		await act(async () => {});

		expect(authServerFnMocks.heartbeatBrowserSessionFn).toHaveBeenCalledTimes(
			1,
		);

		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});

		expect(authServerFnMocks.heartbeatBrowserSessionFn).toHaveBeenCalledTimes(
			2,
		);
	});

	it("pauses while hidden and heartbeats when the document returns", async () => {
		const { unmount } = renderHook(() => useBrowserSessionHeartbeat(true));
		await act(async () => {});

		act(() => setVisibility("hidden"));
		await act(async () => {
			vi.advanceTimersByTime(5_000);
		});
		expect(authServerFnMocks.heartbeatBrowserSessionFn).toHaveBeenCalledTimes(
			1,
		);

		await act(async () => setVisibility("visible"));
		expect(authServerFnMocks.heartbeatBrowserSessionFn).toHaveBeenCalledTimes(
			2,
		);

		unmount();
		await act(async () => {
			vi.advanceTimersByTime(5_000);
		});
		expect(authServerFnMocks.heartbeatBrowserSessionFn).toHaveBeenCalledTimes(
			2,
		);
	});
});
