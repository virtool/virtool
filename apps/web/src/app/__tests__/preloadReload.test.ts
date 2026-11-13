import { createMemoryStorage } from "@tests/memoryStorage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reloadPage } from "../navigation";
import { handlePreloadError } from "../preloadReload";

vi.mock("../navigation", () => ({ reloadPage: vi.fn() }));

const KEY = "vt-preload-reloaded";

beforeEach(() => {
	vi.mocked(reloadPage).mockReset();
	vi.stubGlobal("sessionStorage", createMemoryStorage());
});

describe("handlePreloadError()", () => {
	it("reloads when the running build has not reloaded yet", () => {
		handlePreloadError();

		expect(reloadPage).toHaveBeenCalledOnce();
		expect(sessionStorage.getItem(KEY)).toBe(__APP_VERSION__);
	});

	it("does not reload again for a build that already reloaded", () => {
		sessionStorage.setItem(KEY, __APP_VERSION__);

		handlePreloadError();

		expect(reloadPage).not.toHaveBeenCalled();
	});

	it("reloads again once a redeploy has moved the tab to a new build", () => {
		// The guard was set by an earlier build, which this tab has since reloaded
		// past. A second deploy must still be able to recover the tab.
		sessionStorage.setItem(KEY, "0.0.1-previous");

		handlePreloadError();

		expect(reloadPage).toHaveBeenCalledOnce();
		expect(sessionStorage.getItem(KEY)).toBe(__APP_VERSION__);
	});

	it("reloads when sessionStorage is unavailable", () => {
		vi.stubGlobal("sessionStorage", {
			getItem() {
				throw new Error("denied");
			},
		});

		handlePreloadError();

		expect(reloadPage).toHaveBeenCalledOnce();
	});
});
