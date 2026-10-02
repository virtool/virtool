import { describe, expect, it } from "vitest";
import { safeRedirect } from "../searchParams";

describe("safeRedirect", () => {
	it.each(["/", "/samples", "/samples/1?tab=quality", "/recovery-notes"])(
		"keeps the local path %s",
		(target) => {
			expect(safeRedirect(target)).toBe(target);
		},
	);

	it.each([
		"https://example.com",
		"//example.com",
		"samples",
		"/login",
		"/login?redirect=%2Fsamples",
		"/setup",
		"/account-setup#token=abc",
		"/recover",
		"/verify-email",
		"/email-remediation",
		"/email-remediation-verify",
		"/mfa-enrollment?redirect=%2F",
		42,
		undefined,
	])("discards %s", (target) => {
		expect(safeRedirect(target)).toBeUndefined();
	});
});
