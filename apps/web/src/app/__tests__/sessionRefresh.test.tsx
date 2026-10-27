import { useBrowserSessionRefresh } from "@app/sessionRefresh";
import * as Sentry from "@sentry/tanstackstart-react";
import { act, renderHook } from "@testing-library/react";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { UNAUTHORIZED_ERROR_NAME } from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { endSession } = vi.hoisted(() => ({ endSession: vi.fn() }));
vi.mock("@app/session", () => ({ endSession }));
vi.mock("@sentry/tanstackstart-react", () => ({ captureException: vi.fn() }));

async function focus() {
	await act(async () => {
		window.dispatchEvent(new Event("focus"));
	});
}

describe("useBrowserSessionRefresh", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
		authServerFnMocks.refreshBrowserSessionFn.mockResolvedValue(null);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("refreshes on establishment and focus, without open-tab polling", async () => {
		const { rerender } = renderHook(
			({ enabled }) => useBrowserSessionRefresh(enabled),
			{
				initialProps: { enabled: false },
			},
		);
		expect(authServerFnMocks.refreshBrowserSessionFn).not.toHaveBeenCalled();
		await act(async () => rerender({ enabled: true }));
		expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(1);
		await act(async () => vi.advanceTimersByTimeAsync(8 * 24 * 60 * 60_000));
		expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(1);
		await focus();
		expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(2);
	});

	it("does not refresh for visibility, input, or offline focus", async () => {
		renderHook(() => useBrowserSessionRefresh(true));
		await act(async () => {});
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
			window.dispatchEvent(new Event("pointerdown"));
			window.dispatchEvent(new Event("keydown"));
		});
		vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
		await focus();
		expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(1);
	});

	it("converges on endSession only for definitive authentication failure", async () => {
		authServerFnMocks.refreshBrowserSessionFn.mockRejectedValue(
			Object.assign(new Error("Unauthorized"), {
				name: UNAUTHORIZED_ERROR_NAME,
			}),
		);
		renderHook(() => useBrowserSessionRefresh(true));
		await act(async () => {});
		expect(endSession).toHaveBeenCalledTimes(1);
	});

	it.each([new TypeError("Network error"), new Error("Server unavailable")])(
		"keeps operational failure retryable on the next focus: %s",
		async (error) => {
			authServerFnMocks.refreshBrowserSessionFn.mockRejectedValueOnce(error);
			renderHook(() => useBrowserSessionRefresh(true));
			await act(async () => {});
			expect(endSession).not.toHaveBeenCalled();
			expect(Sentry.captureException).toHaveBeenCalledWith(error);
			await focus();
			expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(
				2,
			);
		},
	);

	it("deduplicates pending refreshes and ignores completion after teardown", async () => {
		const pending = Promise.withResolvers<null>();
		authServerFnMocks.refreshBrowserSessionFn.mockReturnValue(pending.promise);
		const { unmount } = renderHook(() => useBrowserSessionRefresh(true));
		await focus();
		expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(1);
		unmount();
		await act(async () =>
			pending.reject(
				Object.assign(new Error("Unauthorized"), {
					name: UNAUTHORIZED_ERROR_NAME,
				}),
			),
		);
		await focus();
		expect(endSession).not.toHaveBeenCalled();
		expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(1);
	});
});
