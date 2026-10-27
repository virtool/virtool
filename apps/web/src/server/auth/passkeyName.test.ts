import { describe, expect, it } from "vitest";
import { getNewPasskeyName } from "./passkeyName";

const FIREFOX_ON_LINUX =
	"Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0";

describe("getNewPasskeyName", () => {
	it("prefers the provider of a known authenticator", () => {
		expect(
			getNewPasskeyName(
				"fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
				FIREFOX_ON_LINUX,
			),
		).toBe("Apple Passwords");
	});

	it("uses the browser and operating system for an unknown authenticator", () => {
		expect(
			getNewPasskeyName(
				"00000000-0000-0000-0000-000000000000",
				FIREFOX_ON_LINUX,
			),
		).toBe("Firefox on Linux");
	});

	it("falls back to a generic name", () => {
		expect(getNewPasskeyName(undefined, null)).toBe("Passkey");
	});
});
