import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
	it.each([
		"/",
		"/samples",
		"/samples/1?tab=quality",
		"/samples?page=2#files",
		"/recovery-notes",
		"/verify-email",
	])("keeps the local path %s", (target) => {
		expect(safeRedirect(target)).toBe(target);
	});

	it.each([
		["/samples/../refs", "/refs"],
		["/samples/./1", "/samples/1"],
	])("normalizes %s to %s", (target, expected) => {
		expect(safeRedirect(target)).toBe(expected);
	});

	it.each([
		"https://example.com",
		"//example.com",
		"/\\example.com",
		"/samples/../\\example.com",
		"/samples/..//example.com",
		"/.//example.com",
		"/\t/example.com",
		"/\n/example.com",
		"/samples\u0000",
		"samples",
		"/login",
		"/login?redirect=%2Fsamples",
		"/samples/../login",
		"/setup",
		"/account-setup#token=abc",
		"/recover",
		"/verify-email?token=abc",
		"/verify-email#token=abc",
		"/email-remediation",
		"/email-remediation-verify",
		"/mfa-enrollment?redirect=%2F",
		42,
		undefined,
	])("discards %s", (target) => {
		expect(safeRedirect(target)).toBeUndefined();
	});
});
