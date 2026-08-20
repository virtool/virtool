import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handlePreloadError } from "../preloadReload";

const KEY = "vt-preload-reloaded";

const reload = vi.fn();
let originalLocation: Location;

beforeEach(() => {
	reload.mockReset();
	window.sessionStorage.clear();
	originalLocation = window.location;
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { ...originalLocation, reload },
	});
});

afterEach(() => {
	Object.defineProperty(window, "location", {
		configurable: true,
		value: originalLocation,
	});
	window.sessionStorage.clear();
});

describe("handlePreloadError()", () => {
	it("reloads when the running build has not reloaded yet", () => {
		handlePreloadError();

		expect(reload).toHaveBeenCalledOnce();
		expect(window.sessionStorage.getItem(KEY)).toBe(__APP_VERSION__);
	});

	it("does not reload again for a build that already reloaded", () => {
		window.sessionStorage.setItem(KEY, __APP_VERSION__);

		handlePreloadError();

		expect(reload).not.toHaveBeenCalled();
	});

	it("reloads again once a redeploy has moved the tab to a new build", () => {
		// The guard was set by an earlier build, which this tab has since reloaded
		// past. A second deploy must still be able to recover the tab.
		window.sessionStorage.setItem(KEY, "0.0.1-previous");

		handlePreloadError();

		expect(reload).toHaveBeenCalledOnce();
		expect(window.sessionStorage.getItem(KEY)).toBe(__APP_VERSION__);
	});

	it("reloads when sessionStorage is unavailable", () => {
		const getItem = vi
			.spyOn(Storage.prototype, "getItem")
			.mockImplementation(() => {
				throw new Error("denied");
			});

		try {
			handlePreloadError();
			expect(reload).toHaveBeenCalledOnce();
		} finally {
			getItem.mockRestore();
		}
	});
});
