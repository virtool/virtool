import { describe, expect, it } from "vitest";
import {
	cacheKey,
	HMM_ANNOTATIONS_KEY,
	HMM_PROFILES_KEY,
	mintRootStorageKey,
	mintStorageKey,
} from "./keys";

describe("storage keys", () => {
	it("mints a key under its parent", () => {
		expect(mintStorageKey("samples", 7)).toMatch(/^samples\/7\/[0-9a-f]{32}$/);
	});

	it("mints a key with no parent segment", () => {
		expect(mintRootStorageKey("uploads")).toMatch(/^uploads\/[0-9a-f]{32}$/);
	});

	it("mints a distinct key every time", () => {
		expect(mintStorageKey("samples", 7)).not.toBe(mintStorageKey("samples", 7));
		expect(mintRootStorageKey("uploads")).not.toBe(
			mintRootStorageKey("uploads"),
		);
	});

	it("composes cache and hmm keys", () => {
		expect(cacheKey("d34db33f")).toBe("caches/v1/d34db33f");
		expect(HMM_PROFILES_KEY).toBe("hmm/profiles.hmm");
		expect(HMM_ANNOTATIONS_KEY).toBe("hmm/annotations.json.gz");
	});
});
