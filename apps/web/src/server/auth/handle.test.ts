import { describe, expect, test } from "vitest";
import { isValidHandle } from "./handle";

describe("isValidHandle", () => {
	test.each(["bob", "jane.doe", "jane_doe", "Bob2", "a".repeat(30)])(
		"accepts %s",
		(handle) => {
			expect(isValidHandle(handle)).toBe(true);
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
	])("rejects %s", (handle) => {
		expect(isValidHandle(handle)).toBe(false);
	});
});
