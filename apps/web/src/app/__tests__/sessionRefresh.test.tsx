import { useBrowserSessionRefresh } from "@app/sessionRefresh";
import * as Sentry from "@sentry/tanstackstart-react";
import { act, renderHook } from "@testing-library/react";
import { authServerFnMocks } from "@tests/server-fn/auth";
import { UNAUTHORIZED_ERROR_NAME } from "@virtool/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { followAuthError } = vi.hoisted(() => ({ followAuthError: vi.fn() }));
vi.mock("@app/session", () => ({ followAuthError }));
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
		followAuthError.mockReturnValue(false);
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

	it("leaves an auth failure to the auth handler, without reporting it", async () => {
		const error = Object.assign(new Error("Unauthorized"), {
			name: UNAUTHORIZED_ERROR_NAME,
		});
		authServerFnMocks.refreshBrowserSessionFn.mockRejectedValue(error);
		followAuthError.mockReturnValue(true);
		renderHook(() => useBrowserSessionRefresh(true));
		await act(async () => {});
		expect(followAuthError).toHaveBeenCalledWith(error);
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it.each([
		new TypeError("Cannot read properties of undefined"),
		new Error("Server unavailable"),
		new Error("Failed to fetch"),
	])(
		"reports an operational failure and retries on the next focus: %s",
		async (error) => {
			authServerFnMocks.refreshBrowserSessionFn.mockRejectedValueOnce(error);
			renderHook(() => useBrowserSessionRefresh(true));
			await act(async () => {});
			expect(Sentry.captureException).toHaveBeenCalledWith(error);
			await focus();
			expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(
				2,
			);
		},
	);

	it.each([
		new TypeError("Failed to fetch"),
		new TypeError("Failed to fetch (app.virtool.ca)"),
		new TypeError("Load failed"),
		new TypeError("NetworkError when attempting to fetch resource."),
	])(
		"does not report a network failure and retries on the next focus: %s",
		async (error) => {
			authServerFnMocks.refreshBrowserSessionFn.mockRejectedValueOnce(error);
			renderHook(() => useBrowserSessionRefresh(true));
			await act(async () => {});
			expect(Sentry.captureException).not.toHaveBeenCalled();
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
		expect(followAuthError).not.toHaveBeenCalled();
		expect(authServerFnMocks.refreshBrowserSessionFn).toHaveBeenCalledTimes(1);
	});
});
