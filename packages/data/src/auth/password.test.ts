import { describe, expect, it } from "vitest";

import {
	hashPassword,
	isPasswordHash,
	needsRehash,
	TIMING_DUMMY_HASH,
	verifyPassword,
} from "./password";

// A bcrypt hash generated outside this codebase. Pinning an externally
// generated hash ensures the bytea utf-8 round-trip stays compatible with the
// bcrypt-stored values already in the production data.
const EXTERNAL_FIXTURE_PLAINTEXT = "hunter2";
const EXTERNAL_FIXTURE_HASH =
	"$2b$12$anheU95QO4gI0RzsA4CYRO66Uyk0v4OlEc6Z6tJ5z/cLDfIsg4jbS";

// An Argon2id hash of the same password with parameters other than the
// current ones.
const OTHER_PARAMETERS_HASH =
	"$argon2id$v=19$m=8192,t=1,p=1$HC5kdbhfipA1tpZxfm04bQ$neaPMo8amWeWpWLuF7S8nzTj9sbTataiO0M5z3pLtzo";

describe("hashPassword", () => {
	it("returns a Buffer that decodes to an Argon2id hash with the current parameters", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(hash).toBeInstanceOf(Buffer);
		expect(
			hash.toString("utf8").startsWith("$argon2id$v=19$m=19456,t=2,p=1$"),
		).toBe(true);
	});

	it("hashes a password longer than 72 bytes without truncating it", async () => {
		const long = "a".repeat(100);
		const hash = await hashPassword(long);
		expect(await verifyPassword(long, hash)).toBe(true);
		expect(await verifyPassword("a".repeat(72), hash)).toBe(false);
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

	it("verifies an Argon2id hash made with other parameters", async () => {
		const stored = Buffer.from(OTHER_PARAMETERS_HASH, "utf8");
		expect(await verifyPassword(EXTERNAL_FIXTURE_PLAINTEXT, stored)).toBe(true);
		expect(await verifyPassword("wrong", stored)).toBe(false);
	});

	it("rejects bytes that are not a password hash", async () => {
		expect(await verifyPassword("hunter2", Buffer.from("not-a-hash"))).toBe(
			false,
		);
	});
});

describe("isPasswordHash", () => {
	it("accepts bcrypt and Argon2id hashes", async () => {
		expect(isPasswordHash(Buffer.from(EXTERNAL_FIXTURE_HASH))).toBe(true);
		expect(isPasswordHash(Buffer.from(OTHER_PARAMETERS_HASH))).toBe(true);
		expect(isPasswordHash(await hashPassword("hunter2"))).toBe(true);
		expect(isPasswordHash(TIMING_DUMMY_HASH)).toBe(true);
	});

	it("rejects anything else", () => {
		expect(isPasswordHash(null)).toBe(false);
		expect(isPasswordHash(Buffer.from("not-a-hash"))).toBe(false);
		expect(
			isPasswordHash(Buffer.from("$argon2i$v=19$m=19456,t=2,p=1$a$b")),
		).toBe(false);
	});
});

describe("needsRehash", () => {
	it("is false for a hash made with the current parameters", async () => {
		expect(needsRehash(await hashPassword("hunter2"))).toBe(false);
		expect(needsRehash(TIMING_DUMMY_HASH)).toBe(false);
	});

	it("is true for a bcrypt hash and for other Argon2id parameters", () => {
		expect(needsRehash(Buffer.from(EXTERNAL_FIXTURE_HASH))).toBe(true);
		expect(needsRehash(Buffer.from(OTHER_PARAMETERS_HASH))).toBe(true);
	});
});
