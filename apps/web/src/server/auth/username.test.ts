import { describe, expect, test } from "vitest";
import { checkReservedUsername, checkUsername } from "./username";

describe("checkUsername", () => {
	test.each(["bob", "jane.doe", "jane_doe", "Bob2", " bob ", "a".repeat(30)])(
		"accepts %s",
		(username) => {
			expect(() => checkUsername(username)).not.toThrow();
		},
	);

	test.each([
		"",
		"ab",
		"a".repeat(31),
		"bob smith",
		"josé",
		"bob@virtool.ca",
		"jane-doe",
	])("rejects %s", (username) => {
		expect(() => checkUsername(username)).toThrow();
	});
});

describe("checkReservedUsername", () => {
	test.each(["virtool", "Virtool", " VIRTOOL "])("rejects %s", (username) => {
		expect(() => checkReservedUsername(username)).toThrow();
	});
});
