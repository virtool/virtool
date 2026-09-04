import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
	it.each([
		["  bob@example.com  ", "bob@example.com"],
		["Bob@Example.COM", "bob@example.com"],
		["\tbob@example.com\n", "bob@example.com"],
		["", ""],
		["   ", ""],
	])("normalizes %j to %j", (input, expected) => {
		expect(normalizeEmail(input)).toBe(expected);
	});

	it("keeps dots and plus addressing", () => {
		expect(normalizeEmail("Bob.Smith+virtool@Example.com")).toBe(
			"bob.smith+virtool@example.com",
		);
	});
});

describe("isValidEmail", () => {
	it.each([
		"bob@example.com",
		"  Bob@Example.com  ",
		"bob.smith+virtool@example.co.uk",
	])("accepts %j", (email) => {
		expect(isValidEmail(email)).toBe(true);
	});

	it.each(["", "   ", "bob", "bob@example", "bob@@example.com", "bob @ x.com"])(
		"rejects %j",
		(email) => {
			expect(isValidEmail(email)).toBe(false);
		},
	);
});
