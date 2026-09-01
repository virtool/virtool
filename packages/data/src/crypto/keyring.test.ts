import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { createKeyring, type EncryptedValue } from "./keyring";

function key(): string {
	return randomBytes(32).toString("base64");
}

function encryptOrThrow(
	keyring: ReturnType<typeof createKeyring>,
	purpose: string,
	plaintext: string,
): EncryptedValue {
	const result = keyring.encrypt(purpose, plaintext);

	if (!result.ok) {
		throw new Error("test keyring unavailable");
	}

	return result.value;
}

describe("createKeyring", () => {
	test("reports unset when neither key is configured", () => {
		expect(createKeyring(undefined, undefined).status).toEqual({
			state: "unset",
		});
	});

	test("rejects invalid and incomplete key pairs", () => {
		expect(createKeyring("junk", undefined).status.state).toBe("invalid");
		expect(createKeyring(key(), "junk").status.state).toBe("invalid");
		expect(createKeyring(undefined, key()).status.state).toBe("invalid");
	});

	test("unavailable keyrings return explicit operation failures", () => {
		const keyring = createKeyring(undefined, undefined);

		expect(keyring.encrypt("secret", "value")).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});

describe("encryption", () => {
	test("round trips without exposing plaintext and uses fresh nonces", () => {
		const keyring = createKeyring(key(), undefined);
		const first = encryptOrThrow(keyring, "resend_api_key", "re_secret_123");
		const second = encryptOrThrow(keyring, "resend_api_key", "re_secret_123");

		expect(JSON.stringify(first)).not.toContain("re_secret_123");
		expect(first.nonce).not.toBe(second.nonce);
		expect(keyring.decrypt("resend_api_key", first)).toEqual({
			ok: true,
			plaintext: "re_secret_123",
		});
	});

	test("decrypts with the previous key and detects rotation", () => {
		const oldKey = key();
		const value = encryptOrThrow(
			createKeyring(oldKey, undefined),
			"resend_api_key",
			"re_secret",
		);
		const rotated = createKeyring(key(), oldKey);

		expect(rotated.decrypt("resend_api_key", value)).toEqual({
			ok: true,
			plaintext: "re_secret",
		});
		expect(rotated.isCurrent(value)).toBe(false);
	});

	test("rejects the wrong purpose", () => {
		const keyring = createKeyring(key(), undefined);
		const value = encryptOrThrow(keyring, "resend_api_key", "secret");

		expect(keyring.decrypt("ncbi_api_key", value)).toEqual({
			ok: false,
			reason: "wrong_purpose",
		});
	});

	test("rejects unknown keys, tampering, and malformed envelopes", () => {
		const keyring = createKeyring(key(), undefined);
		const value = encryptOrThrow(keyring, "resend_api_key", "secret");

		expect(
			createKeyring(key(), undefined).decrypt("resend_api_key", value),
		).toEqual({ ok: false, reason: "unknown_key" });
		expect(
			keyring.decrypt("resend_api_key", { ...value, ciphertext: "AAAA" }),
		).toEqual({ ok: false, reason: "auth_failed" });
		expect(
			keyring.decrypt("resend_api_key", { ...value, nonce: "AAAA" }),
		).toEqual({ ok: false, reason: "malformed" });
		expect(
			keyring.decrypt("resend_api_key", { ...value, tag: "AAAA" }),
		).toEqual({ ok: false, reason: "malformed" });
	});
});
