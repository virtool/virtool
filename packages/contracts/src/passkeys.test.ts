import { describe, expect, it } from "vitest";
import { PASSKEY_NAME_MAX_LENGTH, passkeyNameSchema } from "./passkeys";

describe("passkeyNameSchema", () => {
	it("collapses and trims whitespace", () => {
		expect(passkeyNameSchema.parse("  Work\t\n  laptop ")).toBe("Work laptop");
	});

	it("accepts a name at the length limit", () => {
		const name = "x".repeat(PASSKEY_NAME_MAX_LENGTH);

		expect(passkeyNameSchema.parse(name)).toBe(name);
	});

	it.each([
		["an empty name", "   "],
		["a name over the limit", "x".repeat(PASSKEY_NAME_MAX_LENGTH + 1)],
		["a C0 control character", "Work\u0007"],
		["a C1 control character", "Work\u0085"],
	])("refuses %s", (_, name) => {
		expect(passkeyNameSchema.safeParse(name).success).toBe(false);
	});
});
