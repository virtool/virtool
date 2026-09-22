import { describe, expect, it } from "vitest";
import {
	getClientIpFromHeaders,
	normalizeBrowserSessionMetadata,
} from "./sessionMetadata";

describe("normalizeBrowserSessionMetadata", () => {
	it.each([
		{
			browser: "Chrome 140.0",
			operatingSystem: "Windows",
			userAgent:
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
		},
		{
			browser: "Safari 18.6",
			operatingSystem: "macOS 15.6",
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15",
		},
		{
			browser: "Firefox 142.0",
			operatingSystem: "Linux",
			userAgent:
				"Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
		},
	])("normalizes $browser on $operatingSystem", (expected) => {
		const metadata = normalizeBrowserSessionMetadata(
			new Headers({ "user-agent": expected.userAgent }),
		);

		expect(metadata.browser).toBe(expected.browser);
		expect(metadata.operatingSystem).toBe(expected.operatingSystem);
	});

	it("bounds and sanitizes an untrusted user agent", () => {
		const metadata = normalizeBrowserSessionMetadata(undefined, {
			userAgent: `unknown\nagent${"x".repeat(600)}`,
		});

		expect(metadata.userAgent).toHaveLength(512);
		expect(metadata.userAgent).not.toContain("\n");
		expect(metadata.browser).toBe("Unknown browser");
		expect(metadata.operatingSystem).toBe("Unknown operating system");
	});

	it("uses safe fallbacks when metadata is absent", () => {
		expect(normalizeBrowserSessionMetadata(undefined)).toEqual({
			browser: "Unknown browser",
			operatingSystem: "Unknown operating system",
			ipAddress: null,
			userAgent: null,
		});
	});

	it("preserves valid IPv4 and IPv6 addresses and rejects invalid input", () => {
		expect(
			getClientIpFromHeaders(new Headers({ "cf-connecting-ip": "192.0.2.1" })),
		).toBe("192.0.2.1");
		expect(
			getClientIpFromHeaders(
				new Headers({ "x-forwarded-for": "2001:db8::1, 198.51.100.1" }),
			),
		).toBe("2001:db8::1");
		expect(
			getClientIpFromHeaders(new Headers({ "x-forwarded-for": "not-an-ip" })),
		).toBeNull();
	});
});
