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
import { DEFAULT_SETTINGS } from "../settings/data";
import { seedSettings } from "../settings/test/fixtures";
import {
	clearEmailApiKey,
	EmailConfigurationError,
	getEmailSettings,
	isEmailEnabled,
	resolveEmailDelivery,
	setEmailApiKey,
	updateEmailDelivery,
} from "./settings";

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

function encrypt(keyring: Keyring, plaintext: string): EncryptedValue {
	const result = keyring.encrypt("resend_api_key", plaintext);

	if (!result.ok) {
		throw new Error("expected ready keyring");
	}

	return result.value;
}

const activeKey = key();
const keyring = createKeyring(activeKey, undefined);

/** A stored envelope plus a sender address: the ready-to-enable baseline. */
async function seedConfigured(withKeyring: Keyring = keyring): Promise<void> {
	await seedSettings(db, {
		emailApiKey: encrypt(withKeyring, "re_secret"),
		emailSenderAddress: "noreply@virtool.example",
	});
}

describe("defaults", () => {
	it("keeps email disabled and unconfigured on a fresh row", async () => {
		expect(DEFAULT_SETTINGS.emailEnabled).toBe(false);
		expect(DEFAULT_SETTINGS.emailApiKey).toBeNull();

		const stored = await getEmailSettings(db);

		expect(stored.enabled).toBe(false);
		expect(stored.apiKeyEnvelope).toBeNull();
	});
});

describe("resolveEmailDelivery", () => {
	it("is unconfigured with no stored key, whatever the keyring", async () => {
		await seedSettings(db);

		const stored = await getEmailSettings(db);

		expect(resolveEmailDelivery(stored, keyring).availability).toBe(
			"unconfigured",
		);
		expect(
			resolveEmailDelivery(stored, createKeyring(undefined, undefined))
				.availability,
		).toBe("unconfigured");
	});

	it("is unconfigured with a key but no sender address", async () => {
		await seedSettings(db, {
			emailApiKey: encrypt(keyring, "re_secret"),
		});

		expect(
			resolveEmailDelivery(await getEmailSettings(db), keyring).availability,
		).toBe("unconfigured");
	});

	it("is a configuration error when a key is stored but the keyring is unset or invalid", async () => {
		await seedConfigured();

		const stored = await getEmailSettings(db);

		expect(
			resolveEmailDelivery(stored, createKeyring(undefined, undefined))
				.availability,
		).toBe("configuration_error");
		expect(
			resolveEmailDelivery(stored, createKeyring("short", undefined))
				.availability,
		).toBe("configuration_error");
	});

	it("is a configuration error when the wrong encryption key is configured", async () => {
		await seedConfigured();

		const state = resolveEmailDelivery(
			await getEmailSettings(db),
			createKeyring(key(), undefined),
		);

		expect(state.availability).toBe("configuration_error");
		expect(state.apiKey).toBeNull();
	});

	it("is ready with a decryptable key and sender while delivery is off", async () => {
		await seedConfigured();

		const state = resolveEmailDelivery(await getEmailSettings(db), keyring);

		expect(state.availability).toBe("ready");
		expect(state.apiKey).toBe("re_secret");
	});

	it("is ready once enabled", async () => {
		await seedConfigured();
		await updateEmailDelivery(db, keyring, { enabled: true });

		expect(
			resolveEmailDelivery(await getEmailSettings(db), keyring).availability,
		).toBe("ready");
	});
});

describe("updateEmailDelivery", () => {
	it("refuses to enable without a stored key", async () => {
		await seedSettings(db, {
			emailSenderAddress: "noreply@virtool.example",
		});

		await expect(
			updateEmailDelivery(db, keyring, { enabled: true }),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("refuses to enable without a sender address", async () => {
		await seedSettings(db, {
			emailApiKey: encrypt(keyring, "re_secret"),
		});

		await expect(
			updateEmailDelivery(db, keyring, { enabled: true }),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("refuses to enable when the stored key cannot be decrypted", async () => {
		await seedConfigured();

		await expect(
			updateEmailDelivery(db, createKeyring(key(), undefined), {
				enabled: true,
			}),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("enables when a sender address arrives in the same update", async () => {
		await seedSettings(db, {
			emailApiKey: encrypt(keyring, "re_secret"),
		});

		const updated = await updateEmailDelivery(db, keyring, {
			enabled: true,
			senderAddress: "noreply@virtool.example",
			senderName: "Virtool",
		});

		expect(updated.enabled).toBe(true);
		expect(updated.senderAddress).toBe("noreply@virtool.example");
	});

	it("disabling preserves the stored key", async () => {
		await seedConfigured();
		await updateEmailDelivery(db, keyring, { enabled: true });

		const updated = await updateEmailDelivery(db, keyring, {
			enabled: false,
		});

		expect(updated.enabled).toBe(false);
		expect(updated.apiKeyEnvelope).not.toBeNull();
	});
});

describe("setEmailApiKey and clearEmailApiKey", () => {
	it("stores an envelope under the active key, never the plaintext", async () => {
		await seedSettings(db);

		const updated = await setEmailApiKey(db, keyring, "re_secret");

		if (updated.apiKeyEnvelope === null) {
			throw new Error("expected a stored envelope");
		}

		expect(keyring.isCurrent(updated.apiKeyEnvelope)).toBe(true);
		expect(JSON.stringify(updated.apiKeyEnvelope)).not.toContain("re_secret");
		expect(keyring.decrypt("resend_api_key", updated.apiKeyEnvelope)).toEqual({
			ok: true,
			plaintext: "re_secret",
		});
	});

	it("replaces an existing key atomically", async () => {
		await seedConfigured();

		const updated = await setEmailApiKey(db, keyring, "re_new_secret");

		if (updated.apiKeyEnvelope === null) {
			throw new Error("expected a stored envelope");
		}

		expect(keyring.decrypt("resend_api_key", updated.apiKeyEnvelope)).toEqual({
			ok: true,
			plaintext: "re_new_secret",
		});
	});

	it("refuses to store a key without a usable keyring", async () => {
		await seedSettings(db);

		await expect(
			setEmailApiKey(db, createKeyring(undefined, undefined), "re_secret"),
		).rejects.toBeInstanceOf(EmailConfigurationError);
		await expect(
			setEmailApiKey(db, createKeyring("short", undefined), "re_secret"),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("clearing removes the key and disables delivery", async () => {
		await seedConfigured();
		await updateEmailDelivery(db, keyring, { enabled: true });

		const cleared = await clearEmailApiKey(db);

		expect(cleared.apiKeyEnvelope).toBeNull();
		expect(cleared.enabled).toBe(false);
	});
});

describe("isEmailEnabled", () => {
	it("is false when no settings row exists", async () => {
		await expect(isEmailEnabled(db)).resolves.toBe(false);
	});

	it("is false while sending is switched off", async () => {
		await seedSettings(db, { emailEnabled: false });

		await expect(isEmailEnabled(db)).resolves.toBe(false);
	});

	it("is true while sending is switched on", async () => {
		await seedSettings(db, { emailEnabled: true });

		await expect(isEmailEnabled(db)).resolves.toBe(true);
	});

	it("does not seed the settings row", async () => {
		await isEmailEnabled(db);

		expect(await db.select().from(settings)).toHaveLength(0);
	});
});
