import { describe, expect, it } from "vitest";
import {
	isSessionFresh,
	PROTECTED_OPERATIONS,
	SESSION_FRESH_AGE_SECONDS,
} from "./freshness";

it("keeps the protected-operation inventory explicit", () => {
	expect(Object.values(PROTECTED_OPERATIONS).sort()).toEqual(
		[
			"account.email.change",
			"account.password.change",
			"api_key.create",
			"api_key.delete",
			"api_key.permissions.update",
			"api_key.rotate",
			"invitation_link.issue",
			"passkey.register",
			"passkey.remove",
			"passkey.security.update",
			"recovery_link.issue",
			"session.revoke.all_other",
			"session.revoke.other",
			"setup_link.issue",
			"totp.disable",
			"totp.enroll",
			"totp.recovery_codes.regenerate",
			"totp.reset",
		].sort(),
	);
});

describe("isSessionFresh", () => {
	const now = Date.UTC(2026, 8, 18, 12);

	it("accepts a session just inside the configured window", () => {
		expect(
			isSessionFresh(new Date(now - SESSION_FRESH_AGE_SECONDS * 1000 + 1), now),
		).toBe(true);
	});

	it("uses Better Auth's inclusive stale boundary", () => {
		expect(
			isSessionFresh(new Date(now - SESSION_FRESH_AGE_SECONDS * 1000), now),
		).toBe(false);
	});
});
