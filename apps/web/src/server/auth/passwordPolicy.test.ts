import { describe, expect, it } from "vitest";

import {
	checkPasswordLength,
	DEFAULT_MINIMUM_PASSWORD_LENGTH,
	formatMinimumPasswordLengthMessage,
	PasswordTooShortError,
} from "./passwordPolicy";

describe("formatMinimumPasswordLengthMessage", () => {
	it("quotes the minimum it was given", () => {
		expect(formatMinimumPasswordLengthMessage(12)).toBe(
			"Password does not meet minimum length requirement (12)",
		);
	});
});

describe("checkPasswordLength", () => {
	it.each([DEFAULT_MINIMUM_PASSWORD_LENGTH, 12, 20])(
		"rejects a password one character short of a minimum of %i",
		(minimum) => {
			expect(() =>
				checkPasswordLength("a".repeat(minimum - 1), minimum),
			).toThrow(new PasswordTooShortError(minimum));
		},
	);

	it.each([DEFAULT_MINIMUM_PASSWORD_LENGTH, 12, 20])(
		"accepts a password of exactly a minimum of %i",
		(minimum) => {
			expect(() =>
				checkPasswordLength("a".repeat(minimum), minimum),
			).not.toThrow();
		},
	);

	it("rejects an empty password", () => {
		expect(() => checkPasswordLength("", 12)).toThrow(PasswordTooShortError);
	});

	it("carries the minimum on the error so callers can quote it", () => {
		try {
			checkPasswordLength("short", 12);
			expect.unreachable("expected checkPasswordLength to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(PasswordTooShortError);
			expect((err as PasswordTooShortError).minimum).toBe(12);
			expect((err as PasswordTooShortError).message).toBe(
				"Password does not meet minimum length requirement (12)",
			);
		}
	});
});
