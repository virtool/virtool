import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { settings } from "../db/schema/settings";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { DEFAULT_SETTINGS } from "../settings/data";
import { seedSettings } from "../settings/test/fixtures";
import {
	decryptEmailApiKey,
	type EmailMasterKeyConfig,
	encryptEmailApiKey,
	parseEmailMasterKeys,
} from "./crypto";
import {
	clearEmailApiKey,
	EmailConfigurationError,
	getEmailSettings,
	reencryptEmailApiKey,
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

function keys(previous?: string): EmailMasterKeyConfig {
	const parsed = parseEmailMasterKeys(
		randomBytes(32).toString("base64"),
		previous,
	);

	if (parsed.status !== "ok") {
		throw new Error("expected valid master keys");
	}

	return parsed;
}

const masterKeys = keys();

/** A stored envelope plus a sender address: the ready-to-enable baseline. */
async function seedConfigured(
	withKeys: EmailMasterKeyConfig = masterKeys,
): Promise<void> {
	if (withKeys.status !== "ok") {
		throw new Error("expected valid master keys");
	}

	await seedSettings(db, {
		emailApiKey: encryptEmailApiKey(withKeys.active, "re_secret"),
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
	it("is unconfigured with no stored key, whatever the master keys", async () => {
		await seedSettings(db);

		const stored = await getEmailSettings(db);

		expect(resolveEmailDelivery(stored, masterKeys).availability).toBe(
			"unconfigured",
		);
		expect(resolveEmailDelivery(stored, { status: "unset" }).availability).toBe(
			"unconfigured",
		);
	});

	it("is unconfigured with a key but no sender address", async () => {
		if (masterKeys.status !== "ok") {
			throw new Error("unreachable");
		}

		await seedSettings(db, {
			emailApiKey: encryptEmailApiKey(masterKeys.active, "re_secret"),
		});

		expect(
			resolveEmailDelivery(await getEmailSettings(db), masterKeys).availability,
		).toBe("unconfigured");
	});

	it("is a configuration error when a key is stored but master keys are missing or invalid", async () => {
		await seedConfigured();

		const stored = await getEmailSettings(db);

		expect(resolveEmailDelivery(stored, { status: "unset" }).availability).toBe(
			"configuration_error",
		);
		expect(
			resolveEmailDelivery(stored, { status: "invalid", reason: "short" })
				.availability,
		).toBe("configuration_error");
	});

	it("is a configuration error when the wrong master key is configured", async () => {
		await seedConfigured();

		const state = resolveEmailDelivery(await getEmailSettings(db), keys());

		expect(state.availability).toBe("configuration_error");
		expect(state.apiKey).toBeNull();
	});

	it("is disabled with a decryptable key and sender while delivery is off", async () => {
		await seedConfigured();

		const state = resolveEmailDelivery(await getEmailSettings(db), masterKeys);

		expect(state.availability).toBe("disabled");
		expect(state.apiKey).toBe("re_secret");
	});

	it("is ready once enabled", async () => {
		await seedConfigured();
		await updateEmailDelivery(db, masterKeys, { enabled: true });

		expect(
			resolveEmailDelivery(await getEmailSettings(db), masterKeys).availability,
		).toBe("ready");
	});
});

describe("updateEmailDelivery", () => {
	it("refuses to enable without a stored key", async () => {
		await seedSettings(db, {
			emailSenderAddress: "noreply@virtool.example",
		});

		await expect(
			updateEmailDelivery(db, masterKeys, { enabled: true }),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("refuses to enable without a sender address", async () => {
		if (masterKeys.status !== "ok") {
			throw new Error("unreachable");
		}

		await seedSettings(db, {
			emailApiKey: encryptEmailApiKey(masterKeys.active, "re_secret"),
		});

		await expect(
			updateEmailDelivery(db, masterKeys, { enabled: true }),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("refuses to enable when the stored key cannot be decrypted", async () => {
		await seedConfigured();

		await expect(
			updateEmailDelivery(db, keys(), { enabled: true }),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("enables when a sender address arrives in the same update", async () => {
		if (masterKeys.status !== "ok") {
			throw new Error("unreachable");
		}

		await seedSettings(db, {
			emailApiKey: encryptEmailApiKey(masterKeys.active, "re_secret"),
		});

		const updated = await updateEmailDelivery(db, masterKeys, {
			enabled: true,
			senderAddress: "noreply@virtool.example",
			senderName: "Virtool",
		});

		expect(updated.enabled).toBe(true);
		expect(updated.senderAddress).toBe("noreply@virtool.example");
	});

	it("disabling preserves the stored key", async () => {
		await seedConfigured();
		await updateEmailDelivery(db, masterKeys, { enabled: true });

		const updated = await updateEmailDelivery(db, masterKeys, {
			enabled: false,
		});

		expect(updated.enabled).toBe(false);
		expect(updated.apiKeyEnvelope).not.toBeNull();
	});
});

describe("setEmailApiKey and clearEmailApiKey", () => {
	it("stores an envelope under the active key, never the plaintext", async () => {
		await seedSettings(db);

		const updated = await setEmailApiKey(db, masterKeys, "re_secret");

		if (masterKeys.status !== "ok" || updated.apiKeyEnvelope === null) {
			throw new Error("expected a stored envelope");
		}

		expect(updated.apiKeyEnvelope.keyId).toBe(masterKeys.active.id);
		expect(JSON.stringify(updated.apiKeyEnvelope)).not.toContain("re_secret");
		expect(decryptEmailApiKey(masterKeys, updated.apiKeyEnvelope)).toEqual({
			ok: true,
			plaintext: "re_secret",
		});
	});

	it("replaces an existing key atomically", async () => {
		await seedConfigured();

		const updated = await setEmailApiKey(db, masterKeys, "re_new_secret");

		if (masterKeys.status !== "ok" || updated.apiKeyEnvelope === null) {
			throw new Error("expected a stored envelope");
		}

		expect(decryptEmailApiKey(masterKeys, updated.apiKeyEnvelope)).toEqual({
			ok: true,
			plaintext: "re_new_secret",
		});
	});

	it("refuses to store a key without usable master keys", async () => {
		await seedSettings(db);

		await expect(
			setEmailApiKey(db, { status: "unset" }, "re_secret"),
		).rejects.toBeInstanceOf(EmailConfigurationError);
		await expect(
			setEmailApiKey(db, { status: "invalid", reason: "short" }, "re_secret"),
		).rejects.toBeInstanceOf(EmailConfigurationError);
	});

	it("clearing removes the key and disables delivery", async () => {
		await seedConfigured();
		await updateEmailDelivery(db, masterKeys, { enabled: true });

		const cleared = await clearEmailApiKey(db);

		expect(cleared.apiKeyEnvelope).toBeNull();
		expect(cleared.enabled).toBe(false);
	});
});

describe("reencryptEmailApiKey", () => {
	it("reads under the old key and rewrites under the new one", async () => {
		const oldKeys = keys();

		if (oldKeys.status !== "ok") {
			throw new Error("unreachable");
		}

		await seedConfigured(oldKeys);

		const rotated = keys(oldKeys.active.key.toString("base64"));

		if (rotated.status !== "ok") {
			throw new Error("unreachable");
		}

		await expect(reencryptEmailApiKey(db, rotated)).resolves.toBe(
			"reencrypted",
		);

		// The old key is gone, and the envelope still reads under the new one.
		const withoutOld = parseEmailMasterKeys(
			rotated.active.key.toString("base64"),
			undefined,
		);
		const stored = await getEmailSettings(db);

		expect(stored.apiKeyEnvelope?.keyId).toBe(rotated.active.id);
		expect(resolveEmailDelivery(stored, withoutOld).apiKey).toBe("re_secret");
	});

	it("is idempotent: a second run reports already_current", async () => {
		const oldKeys = keys();

		if (oldKeys.status !== "ok") {
			throw new Error("unreachable");
		}

		await seedConfigured(oldKeys);

		const rotated = keys(oldKeys.active.key.toString("base64"));

		await expect(reencryptEmailApiKey(db, rotated)).resolves.toBe(
			"reencrypted",
		);
		await expect(reencryptEmailApiKey(db, rotated)).resolves.toBe(
			"already_current",
		);
	});

	it("reports no_key when nothing is stored", async () => {
		await seedSettings(db);

		await expect(reencryptEmailApiKey(db, masterKeys)).resolves.toBe("no_key");
	});

	it("reports unavailable for missing or wrong master keys and leaves the envelope alone", async () => {
		await seedConfigured();

		await expect(reencryptEmailApiKey(db, { status: "unset" })).resolves.toBe(
			"unavailable",
		);
		await expect(reencryptEmailApiKey(db, keys())).resolves.toBe("unavailable");

		const stored = await getEmailSettings(db);

		expect(resolveEmailDelivery(stored, masterKeys).apiKey).toBe("re_secret");
	});
});
