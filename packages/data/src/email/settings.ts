// Email delivery configuration over the `settings` singleton.
//
// These functions own every write that touches the encrypted API-key envelope,
// so the envelope's invariants — encrypted under the active master key, never
// silently cleared, never overwritten on a decryption failure — live in one
// place. Reads and writes of the non-secret delivery fields go through here
// too, because enabling delivery is only valid against the stored key and the
// two must be checked and written in one transaction.

import type {
	EmailAvailability,
	EmailReencryptResult,
} from "@virtool/contracts";
import { eq } from "drizzle-orm";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { settings as settingsTable } from "../db/schema/settings";
import { AppError } from "../errors";
import { getSettings, type Settings } from "../settings/data";
import {
	decryptEmailApiKey,
	type EmailApiKeyEnvelope,
	type EmailMasterKeyConfig,
	encryptEmailApiKey,
} from "./crypto";

/** The `settings` table holds a single row, pinned to this id by a check constraint. */
const SETTINGS_ID = 1;

/** Thrown when a write would leave email delivery in an unusable state. */
export class EmailConfigurationError extends AppError {}

/** The stored email delivery configuration, envelope included. Server-only. */
export type EmailDeliverySettings = {
	apiKeyEnvelope: EmailApiKeyEnvelope | null;
	enabled: boolean;
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
};

/**
 * The delivery configuration resolved against this process's master keys.
 *
 * `apiKey` is the decrypted Resend key whenever the stored envelope is
 * decryptable — including while delivery is disabled, which is what lets a
 * test send validate a configuration before it is enabled. It must never
 * cross a transport boundary or reach a log.
 */
export type EmailDeliveryState = {
	availability: EmailAvailability;
	apiKey: string | null;
	settings: EmailDeliverySettings;
};

function toEmailDeliverySettings(settings: Settings): EmailDeliverySettings {
	return {
		apiKeyEnvelope: settings.emailApiKey,
		enabled: settings.emailEnabled,
		replyToAddress: settings.emailReplyToAddress,
		senderAddress: settings.emailSenderAddress,
		senderName: settings.emailSenderName,
	};
}

/** Read the stored email delivery configuration, seeding defaults if absent. */
export async function getEmailSettings(db: Db): Promise<EmailDeliverySettings> {
	return toEmailDeliverySettings(await getSettings(db));
}

/**
 * Resolve the stored configuration against the master keys this process holds.
 *
 * The availability rules, in order:
 *
 * - no stored key or no sender address: `unconfigured`, whatever the master
 *   key situation — there is nothing to decrypt or send as;
 * - stored key but master keys unset, invalid, or unable to decrypt the
 *   envelope: `configuration_error`. The stored envelope is left exactly as it
 *   is — an undecryptable configuration is unavailable, not clearable;
 * - decryptable key and sender, delivery off: `disabled`;
 * - all of the above and delivery on: `ready`.
 */
export function resolveEmailDelivery(
	settings: EmailDeliverySettings,
	masterKeys: EmailMasterKeyConfig,
): EmailDeliveryState {
	if (settings.apiKeyEnvelope === null || settings.senderAddress === "") {
		return { availability: "unconfigured", apiKey: null, settings };
	}

	if (masterKeys.status !== "ok") {
		return { availability: "configuration_error", apiKey: null, settings };
	}

	const decrypted = decryptEmailApiKey(masterKeys, settings.apiKeyEnvelope);

	if (!decrypted.ok) {
		return { availability: "configuration_error", apiKey: null, settings };
	}

	return {
		availability: settings.enabled ? "ready" : "disabled",
		apiKey: decrypted.plaintext,
		settings,
	};
}

/** The non-secret delivery fields {@link updateEmailDelivery} accepts. */
export type EmailDeliveryUpdate = Partial<{
	enabled: boolean;
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
}>;

/**
 * Update the non-secret delivery fields, holding the row lock across the
 * validity check.
 *
 * Enabling delivery fails unless the merged result carries a sender address
 * and a stored key the active master keys can decrypt — checked inside the
 * transaction so a concurrent key clear cannot slip an enabled-but-keyless
 * configuration through. Disabling never touches the stored key.
 */
export async function updateEmailDelivery(
	db: Db,
	masterKeys: EmailMasterKeyConfig,
	values: EmailDeliveryUpdate,
): Promise<EmailDeliverySettings> {
	await getSettings(db);

	return db.transaction(async (tx) => {
		const row = takeFirstOrThrow(
			await tx
				.select()
				.from(settingsTable)
				.where(eq(settingsTable.id, SETTINGS_ID))
				.for("update"),
		);

		const merged: EmailDeliverySettings = {
			apiKeyEnvelope: row.emailApiKey,
			enabled: values.enabled ?? row.emailEnabled,
			replyToAddress: values.replyToAddress ?? row.emailReplyToAddress,
			senderAddress: values.senderAddress ?? row.emailSenderAddress,
			senderName: values.senderName ?? row.emailSenderName,
		};

		if (merged.enabled) {
			const state = resolveEmailDelivery(merged, masterKeys);

			if (state.availability === "unconfigured") {
				throw new EmailConfigurationError(
					"email delivery needs a stored API key and a sender address before it can be enabled",
				);
			}

			if (state.availability === "configuration_error") {
				throw new EmailConfigurationError(
					"the stored API key cannot be decrypted with the configured master key",
				);
			}
		}

		await tx
			.update(settingsTable)
			.set({
				emailEnabled: merged.enabled,
				emailReplyToAddress: merged.replyToAddress,
				emailSenderAddress: merged.senderAddress,
				emailSenderName: merged.senderName,
			})
			.where(eq(settingsTable.id, SETTINGS_ID));

		return merged;
	});
}

/**
 * Encrypt `apiKey` under the active master key and store the envelope.
 *
 * Requires usable master keys: a key stored without them could never be read
 * back, and refusing here is what surfaces the misconfiguration at the moment
 * an administrator can act on it.
 */
export async function setEmailApiKey(
	db: Db,
	masterKeys: EmailMasterKeyConfig,
	apiKey: string,
): Promise<EmailDeliverySettings> {
	if (masterKeys.status !== "ok") {
		throw new EmailConfigurationError(
			"an email master key must be configured before an API key can be stored",
		);
	}

	await getSettings(db);

	const row = takeFirstOrThrow(
		await db
			.update(settingsTable)
			.set({ emailApiKey: encryptEmailApiKey(masterKeys.active, apiKey) })
			.where(eq(settingsTable.id, SETTINGS_ID))
			.returning(),
	);

	return {
		apiKeyEnvelope: row.emailApiKey,
		enabled: row.emailEnabled,
		replyToAddress: row.emailReplyToAddress,
		senderAddress: row.emailSenderAddress,
		senderName: row.emailSenderName,
	};
}

/**
 * Clear the stored API key, disabling delivery in the same write.
 *
 * The two move together because an enabled configuration without a key is a
 * state nothing can act on — every send would fail as unconfigured.
 */
export async function clearEmailApiKey(db: Db): Promise<EmailDeliverySettings> {
	await getSettings(db);

	const row = takeFirstOrThrow(
		await db
			.update(settingsTable)
			.set({ emailApiKey: null, emailEnabled: false })
			.where(eq(settingsTable.id, SETTINGS_ID))
			.returning(),
	);

	return {
		apiKeyEnvelope: row.emailApiKey,
		enabled: row.emailEnabled,
		replyToAddress: row.emailReplyToAddress,
		senderAddress: row.emailSenderAddress,
		senderName: row.emailSenderName,
	};
}

/**
 * Re-encrypt the stored API key under the active master key.
 *
 * The rotation step run after the new key is deployed and before the old one
 * is removed. Idempotent: an envelope already under the active key reports
 * `already_current` and is not rewritten. A key that cannot be decrypted —
 * unusable master keys, an unknown identifier, or an authentication failure —
 * reports `unavailable` and leaves the envelope untouched.
 */
export async function reencryptEmailApiKey(
	db: Db,
	masterKeys: EmailMasterKeyConfig,
): Promise<EmailReencryptResult> {
	await getSettings(db);

	return db.transaction(async (tx) => {
		const row = takeFirstOrThrow(
			await tx
				.select({ emailApiKey: settingsTable.emailApiKey })
				.from(settingsTable)
				.where(eq(settingsTable.id, SETTINGS_ID))
				.for("update"),
		);

		if (row.emailApiKey === null) {
			return "no_key";
		}

		if (masterKeys.status !== "ok") {
			return "unavailable";
		}

		if (row.emailApiKey.keyId === masterKeys.active.id) {
			return "already_current";
		}

		const decrypted = decryptEmailApiKey(masterKeys, row.emailApiKey);

		if (!decrypted.ok) {
			return "unavailable";
		}

		await tx
			.update(settingsTable)
			.set({
				emailApiKey: encryptEmailApiKey(masterKeys.active, decrypted.plaintext),
			})
			.where(eq(settingsTable.id, SETTINGS_ID));

		return "reencrypted";
	});
}
