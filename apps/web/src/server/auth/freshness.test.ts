import { describe, expect, it } from "vitest";
import {
	getSessionFreshRemainingMs,
	isSessionFresh,
	PROTECTED_OPERATIONS,
	SESSION_FRESH_AGE_SECONDS,
} from "./freshness";

it("keeps the protected-operation inventory explicit", () => {
	expect(Object.values(PROTECTED_OPERATIONS).sort()).toEqual(
		[
			"account.email.change",
			"administrator_role.set",
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
			"user.update",
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

describe("getSessionFreshRemainingMs", () => {
	const now = Date.UTC(2026, 8, 18, 12);

	it("returns the time left in the freshness window", () => {
		expect(getSessionFreshRemainingMs(new Date(now - 60_000), now)).toBe(
			SESSION_FRESH_AGE_SECONDS * 1000 - 60_000,
		);
	});

	it("returns 0 at and beyond the stale boundary", () => {
		expect(
			getSessionFreshRemainingMs(
				new Date(now - SESSION_FRESH_AGE_SECONDS * 1000),
				now,
			),
		).toBe(0);
		expect(
			getSessionFreshRemainingMs(
				new Date(now - SESSION_FRESH_AGE_SECONDS * 2000),
				now,
			),
		).toBe(0);
	});
});
