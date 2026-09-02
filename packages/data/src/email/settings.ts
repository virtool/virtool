import type {
	EmailAvailability,
	EmailReencryptResult,
} from "@virtool/contracts";
import { eq } from "drizzle-orm";
import type { EncryptedValue, Keyring } from "../crypto/keyring";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { settings as settingsTable } from "../db/schema/settings";
import { AppError } from "../errors";
import { getSettings, type Settings } from "../settings/data";

const SETTINGS_ID = 1;

const RESEND_API_KEY_PURPOSE = "resend_api_key";

/** Thrown when a write would leave email delivery in an unusable state. */
export class EmailConfigurationError extends AppError {}

/** The stored email delivery configuration, envelope included. Server-only. */
export type EmailDeliverySettings = {
	apiKeyEnvelope: EncryptedValue | null;
	enabled: boolean;
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
};

/** Email delivery configuration resolved against the process keyring. */
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

/** Resolve stored delivery settings against the process keyring. */
export function resolveEmailDelivery(
	settings: EmailDeliverySettings,
	keyring: Keyring,
): EmailDeliveryState {
	if (settings.apiKeyEnvelope === null || settings.senderAddress === "") {
		return { availability: "unconfigured", apiKey: null, settings };
	}

	if (keyring.status.state !== "ready") {
		return { availability: "configuration_error", apiKey: null, settings };
	}

	const decrypted = keyring.decrypt(
		RESEND_API_KEY_PURPOSE,
		settings.apiKeyEnvelope,
	);

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

/** Update non-secret settings while locking the row across validation. */
export async function updateEmailDelivery(
	db: Db,
	keyring: Keyring,
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
			const state = resolveEmailDelivery(merged, keyring);

			if (state.availability === "unconfigured") {
				throw new EmailConfigurationError(
					"email delivery needs a stored API key and a sender address before it can be enabled",
				);
			}

			if (state.availability === "configuration_error") {
				throw new EmailConfigurationError(
					"the stored API key cannot be decrypted with the configured encryption key",
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

/** Encrypt and store an API key under the active encryption key. */
export async function setEmailApiKey(
	db: Db,
	keyring: Keyring,
	apiKey: string,
): Promise<EmailDeliverySettings> {
	const encrypted = keyring.encrypt(RESEND_API_KEY_PURPOSE, apiKey);

	if (!encrypted.ok) {
		throw new EmailConfigurationError(
			"an encryption key must be configured before an API key can be stored",
		);
	}

	await getSettings(db);

	const row = takeFirstOrThrow(
		await db
			.update(settingsTable)
			.set({ emailApiKey: encrypted.value })
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

/** Clear the stored API key and disable delivery. */
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

/** Re-encrypt the stored API key under the active encryption key. */
export async function reencryptEmailApiKey(
	db: Db,
	keyring: Keyring,
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

		if (keyring.status.state !== "ready") {
			return "unavailable";
		}

		const decrypted = keyring.decrypt(RESEND_API_KEY_PURPOSE, row.emailApiKey);

		if (!decrypted.ok) {
			return "unavailable";
		}

		if (keyring.isCurrent(row.emailApiKey)) {
			return "already_current";
		}

		const encrypted = keyring.encrypt(
			RESEND_API_KEY_PURPOSE,
			decrypted.plaintext,
		);

		if (!encrypted.ok) {
			return "unavailable";
		}

		await tx
			.update(settingsTable)
			.set({
				emailApiKey: encrypted.value,
			})
			.where(eq(settingsTable.id, SETTINGS_ID));

		return "reencrypted";
	});
}
