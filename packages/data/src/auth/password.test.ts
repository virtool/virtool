import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

// A bcrypt hash generated outside this codebase. Pinning an externally
// generated hash ensures the bytea utf-8 round-trip stays compatible with the
// bcrypt-stored values already in the production data.
const EXTERNAL_FIXTURE_PLAINTEXT = "hunter2";
const EXTERNAL_FIXTURE_HASH =
	"$2b$12$anheU95QO4gI0RzsA4CYRO66Uyk0v4OlEc6Z6tJ5z/cLDfIsg4jbS";

describe("hashPassword", () => {
	it("returns a Buffer that decodes to a $2b$12$ bcrypt string", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(hash).toBeInstanceOf(Buffer);
		expect(hash.toString("utf8").startsWith("$2b$12$")).toBe(true);
	});
});

describe("verifyPassword", () => {
	it("verifies a freshly-hashed password", async () => {
		const hash = await hashPassword("hunter2");
		expect(await verifyPassword("hunter2", hash)).toBe(true);
	});

	it("rejects a wrong password", async () => {
		const hash = await hashPassword("hunter2");
		expect(await verifyPassword("wrong", hash)).toBe(false);
	});

	it("verifies an external bcrypt hash via bytea round-trip", async () => {
		const stored = Buffer.from(EXTERNAL_FIXTURE_HASH, "utf8");
		expect(await verifyPassword(EXTERNAL_FIXTURE_PLAINTEXT, stored)).toBe(true);
		expect(await verifyPassword("wrong", stored)).toBe(false);
	});
});
