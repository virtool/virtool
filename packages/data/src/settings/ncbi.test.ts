import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	createKeyring,
	type EncryptedValue,
	type Keyring,
} from "../crypto/keyring";
import type { Db } from "../db/pg";
import { settings } from "../db/schema/settings";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { getSettings } from "./data";
import {
	clearNcbiApiKey,
	NcbiConfigurationError,
	reencryptNcbiApiKey,
	resolveNcbiApiKey,
	setNcbiApiKey,
} from "./ncbi";
import { seedSettings } from "./test/fixtures";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(settings);
});

function key(): string {
	return randomBytes(32).toString("base64");
}

function encrypt(
	keyring: Keyring,
	plaintext: string,
	purpose = "ncbi_api_key",
): EncryptedValue {
	const result = keyring.encrypt(purpose, plaintext);

	if (!result.ok) {
		throw new Error("expected ready keyring");
	}

	return result.value;
}

const activeKey = key();
const keyring = createKeyring(activeKey, undefined);

async function storedEnvelope(): Promise<EncryptedValue | null> {
	return (await getSettings(db)).ncbiApiKey;
}

describe("resolveNcbiApiKey", () => {
	it("reports an absent key as unconfigured", () => {
		expect(resolveNcbiApiKey(null, keyring)).toEqual({
			availability: "unconfigured",
			apiKey: null,
		});
	});

	it("decrypts a key written under the active key", () => {
		expect(resolveNcbiApiKey(encrypt(keyring, "secret-key"), keyring)).toEqual({
			availability: "ready",
			apiKey: "secret-key",
		});
	});

	it("decrypts a key written under the previous key", () => {
		const previousKey = key();
		const envelope = encrypt(
			createKeyring(previousKey, undefined),
			"secret-key",
		);

		expect(
			resolveNcbiApiKey(envelope, createKeyring(activeKey, previousKey)),
		).toEqual({ availability: "ready", apiKey: "secret-key" });
	});

	it("reports a configuration error with no encryption key configured", () => {
		expect(
			resolveNcbiApiKey(
				encrypt(keyring, "secret-key"),
				createKeyring(undefined, undefined),
			),
		).toEqual({ availability: "configuration_error", apiKey: null });
	});

	it("reports a configuration error for an unknown key", () => {
		expect(
			resolveNcbiApiKey(
				encrypt(keyring, "secret-key"),
				createKeyring(key(), undefined),
			),
		).toEqual({ availability: "configuration_error", apiKey: null });
	});

	// The purpose is the additional authenticated data, so an envelope moved
	// from the `email_api_key` column into this one fails rather than decrypting
	// under a credential it was never written for.
	it("reports a configuration error for the wrong purpose", () => {
		expect(
			resolveNcbiApiKey(
				encrypt(keyring, "re_secret", "resend_api_key"),
				keyring,
			),
		).toEqual({ availability: "configuration_error", apiKey: null });
	});

	it("reports a configuration error for a malformed envelope", () => {
		expect(
			resolveNcbiApiKey(
				{ ...encrypt(keyring, "secret-key"), nonce: "AAAA" },
				keyring,
			),
		).toEqual({ availability: "configuration_error", apiKey: null });
	});

	it("reports a configuration error for tampered ciphertext", () => {
		const envelope = encrypt(keyring, "secret-key");

		expect(
			resolveNcbiApiKey(
				{ ...envelope, ciphertext: Buffer.from("forged").toString("base64") },
				keyring,
			),
		).toEqual({ availability: "configuration_error", apiKey: null });
	});
});

describe("setNcbiApiKey and clearNcbiApiKey", () => {
	it("stores an envelope under the active key, never the plaintext", async () => {
		await seedSettings(db);

		const { ncbiApiKey } = await setNcbiApiKey(db, keyring, "secret-key");

		if (ncbiApiKey === null) {
			throw new Error("expected a stored envelope");
		}

		expect(keyring.isCurrent(ncbiApiKey)).toBe(true);
		expect(ncbiApiKey.purpose).toBe("ncbi_api_key");
		expect(JSON.stringify(ncbiApiKey)).not.toContain("secret-key");
		expect(keyring.decrypt("ncbi_api_key", ncbiApiKey)).toEqual({
			ok: true,
			plaintext: "secret-key",
		});
	});

	it("seeds the settings row when it is absent", async () => {
		await setNcbiApiKey(db, keyring, "secret-key");

		expect(await db.select().from(settings)).toHaveLength(1);
	});

	it("replaces an existing key", async () => {
		await seedSettings(db, { ncbiApiKey: encrypt(keyring, "old-key") });

		const { ncbiApiKey } = await setNcbiApiKey(db, keyring, "new-key");

		if (ncbiApiKey === null) {
			throw new Error("expected a stored envelope");
		}

		expect(keyring.decrypt("ncbi_api_key", ncbiApiKey)).toEqual({
			ok: true,
			plaintext: "new-key",
		});
	});

	it("refuses to store a key without a usable keyring", async () => {
		await seedSettings(db);

		await expect(
			setNcbiApiKey(db, createKeyring(undefined, undefined), "secret-key"),
		).rejects.toBeInstanceOf(NcbiConfigurationError);

		expect(await storedEnvelope()).toBeNull();
	});

	it("clears a stored key", async () => {
		await seedSettings(db, { ncbiApiKey: encrypt(keyring, "secret-key") });

		expect((await clearNcbiApiKey(db)).ncbiApiKey).toBeNull();
		expect(await storedEnvelope()).toBeNull();
	});
});

describe("reencryptNcbiApiKey", () => {
	it("rewrites a key held under the previous key", async () => {
		const previousKey = key();
		await seedSettings(db, {
			ncbiApiKey: encrypt(createKeyring(previousKey, undefined), "secret-key"),
		});

		const rotating = createKeyring(activeKey, previousKey);
		const { ncbiApiKey } = await reencryptNcbiApiKey(db, rotating);

		if (ncbiApiKey === null) {
			throw new Error("expected a stored envelope");
		}

		expect(rotating.isCurrent(ncbiApiKey)).toBe(true);

		// The point of the rotation: the value now reads under the active key
		// alone, so the previous key can be removed.
		expect(
			resolveNcbiApiKey(ncbiApiKey, createKeyring(activeKey, undefined)),
		).toEqual({ availability: "ready", apiKey: "secret-key" });
	});

	it("leaves a key already under the active key alone", async () => {
		const envelope = encrypt(keyring, "secret-key");
		await seedSettings(db, { ncbiApiKey: envelope });

		const { ncbiApiKey } = await reencryptNcbiApiKey(db, keyring);

		expect(ncbiApiKey).toEqual(envelope);
	});

	it("is idempotent across repeated runs", async () => {
		const previousKey = key();
		await seedSettings(db, {
			ncbiApiKey: encrypt(createKeyring(previousKey, undefined), "secret-key"),
		});

		const rotating = createKeyring(activeKey, previousKey);
		await reencryptNcbiApiKey(db, rotating);
		const first = await storedEnvelope();
		await reencryptNcbiApiKey(db, rotating);

		expect(await storedEnvelope()).toEqual(first);
	});

	it("does nothing when no key is stored", async () => {
		await seedSettings(db);

		expect((await reencryptNcbiApiKey(db, keyring)).ncbiApiKey).toBeNull();
	});

	// A rotation run with the wrong previous key must not cost the deployment
	// its credential: the operator sets the right one and runs again.
	it("leaves a key it cannot decrypt in place", async () => {
		const envelope = encrypt(createKeyring(key(), undefined), "secret-key");
		await seedSettings(db, { ncbiApiKey: envelope });

		await expect(reencryptNcbiApiKey(db, keyring)).rejects.toBeInstanceOf(
			NcbiConfigurationError,
		);

		expect(await storedEnvelope()).toEqual(envelope);
	});

	// The active key id alone says nothing about the rest of the envelope. A
	// tampered value that carries it must not be reported as already rotated.
	it("rejects an unreadable envelope written under the active key", async () => {
		const envelope = encrypt(keyring, "secret-key");
		await seedSettings(db, {
			ncbiApiKey: {
				...envelope,
				ciphertext: encrypt(keyring, "other").ciphertext,
			},
		});

		await expect(reencryptNcbiApiKey(db, keyring)).rejects.toBeInstanceOf(
			NcbiConfigurationError,
		);
	});
});
