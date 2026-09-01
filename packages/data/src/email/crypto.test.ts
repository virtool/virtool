import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	decryptEmailApiKey,
	type EmailApiKeyEnvelope,
	encryptEmailApiKey,
	parseEmailMasterKeys,
} from "./crypto";

function key(): string {
	return randomBytes(32).toString("base64");
}

function parsedOrThrow(active: string, previous?: string) {
	const parsed = parseEmailMasterKeys(active, previous);

	if (parsed.status !== "ok") {
		throw new Error("expected valid master keys");
	}

	return parsed;
}

describe("parseEmailMasterKeys", () => {
	it("returns unset when nothing is configured", () => {
		expect(parseEmailMasterKeys(undefined, undefined)).toEqual({
			status: "unset",
		});
	});

	it("parses a valid active key and fingerprints it", () => {
		const parsed = parsedOrThrow(key());

		expect(parsed.active.id).toMatch(/^[0-9a-f]{16}$/);
		expect(parsed.active.key.length).toBe(32);
		expect(parsed.previous).toBeNull();
	});

	it("parses an active and previous key pair", () => {
		const parsed = parsedOrThrow(key(), key());

		expect(parsed.previous).not.toBeNull();
		expect(parsed.previous?.id).not.toBe(parsed.active.id);
	});

	it("derives the same identifier for the same key material", () => {
		const value = key();

		expect(parsedOrThrow(value).active.id).toBe(parsedOrThrow(value).active.id);
	});

	it.each([
		["too short", randomBytes(16).toString("base64")],
		["too long", randomBytes(48).toString("base64")],
		["not base64", "definitely-not-base64!!"],
		["hex encoded", randomBytes(32).toString("hex")],
	])("rejects an active key that is %s", (_, value) => {
		const parsed = parseEmailMasterKeys(value, undefined);

		expect(parsed.status).toBe("invalid");

		if (parsed.status === "invalid") {
			expect(parsed.reason).not.toContain(value);
		}
	});

	it("rejects an invalid previous key", () => {
		expect(parseEmailMasterKeys(key(), "junk").status).toBe("invalid");
	});

	it("rejects a previous key without an active one", () => {
		expect(parseEmailMasterKeys(undefined, key()).status).toBe("invalid");
	});
});

describe("encryptEmailApiKey and decryptEmailApiKey", () => {
	it("round-trips a plaintext under the active key", () => {
		const keys = parsedOrThrow(key());
		const envelope = encryptEmailApiKey(keys.active, "re_secret_123");

		expect(envelope.version).toBe(1);
		expect(envelope.algorithm).toBe("aes-256-gcm");
		expect(envelope.keyId).toBe(keys.active.id);
		expect(envelope.ciphertext).not.toContain("re_secret_123");

		expect(decryptEmailApiKey(keys, envelope)).toEqual({
			ok: true,
			plaintext: "re_secret_123",
		});
	});

	it("uses a fresh nonce per envelope", () => {
		const keys = parsedOrThrow(key());

		expect(encryptEmailApiKey(keys.active, "x").nonce).not.toBe(
			encryptEmailApiKey(keys.active, "x").nonce,
		);
	});

	it("decrypts an envelope written under the previous key", () => {
		const oldValue = key();
		const oldKeys = parsedOrThrow(oldValue);
		const envelope = encryptEmailApiKey(oldKeys.active, "re_secret_123");

		const rotated = parsedOrThrow(key(), oldValue);

		expect(decryptEmailApiKey(rotated, envelope)).toEqual({
			ok: true,
			plaintext: "re_secret_123",
		});
	});

	it("reports unknown_key when no configured key matches the identifier", () => {
		const envelope = encryptEmailApiKey(
			parsedOrThrow(key()).active,
			"re_secret_123",
		);

		expect(decryptEmailApiKey(parsedOrThrow(key()), envelope)).toEqual({
			ok: false,
			reason: "unknown_key",
		});
	});

	it("reports auth_failed for a tampered ciphertext and never falls back", () => {
		const keys = parsedOrThrow(key(), key());
		const envelope = encryptEmailApiKey(keys.active, "re_secret_123");

		const tampered: EmailApiKeyEnvelope = {
			...envelope,
			ciphertext: Buffer.from("tampered-bytes-here").toString("base64"),
		};

		expect(decryptEmailApiKey(keys, tampered)).toEqual({
			ok: false,
			reason: "auth_failed",
		});
	});

	it("reports auth_failed when the key does not match its claimed identifier", () => {
		const keys = parsedOrThrow(key());
		const envelope = encryptEmailApiKey(keys.active, "re_secret_123");

		const wrong = parsedOrThrow(key());
		const lying = {
			active: { ...wrong.active, id: keys.active.id },
			previous: null,
		};

		expect(decryptEmailApiKey(lying, envelope)).toEqual({
			ok: false,
			reason: "auth_failed",
		});
	});

	it("reports malformed for an unsupported version or algorithm", () => {
		const keys = parsedOrThrow(key());
		const envelope = encryptEmailApiKey(keys.active, "x");

		expect(
			decryptEmailApiKey(keys, {
				...envelope,
				version: 2,
			} as unknown as EmailApiKeyEnvelope),
		).toEqual({ ok: false, reason: "malformed" });

		expect(
			decryptEmailApiKey(keys, {
				...envelope,
				algorithm: "aes-128-gcm",
			} as unknown as EmailApiKeyEnvelope),
		).toEqual({ ok: false, reason: "malformed" });
	});

	it("reports malformed for a truncated nonce or tag", () => {
		const keys = parsedOrThrow(key());
		const envelope = encryptEmailApiKey(keys.active, "x");

		expect(decryptEmailApiKey(keys, { ...envelope, nonce: "AAAA" })).toEqual({
			ok: false,
			reason: "malformed",
		});
		expect(decryptEmailApiKey(keys, { ...envelope, tag: "AAAA" })).toEqual({
			ok: false,
			reason: "malformed",
		});
	});
});
