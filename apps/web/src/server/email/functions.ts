import { createServerFn } from "@tanstack/react-start";
import type {
	EmailReencryptResult,
	EmailSettings,
	EmailTestResult,
} from "@virtool/contracts";
import {
	clearEmailApiKey,
	type EmailDeliverySettings,
	getEmailSettings,
	reencryptEmailApiKey,
	resolveEmailDelivery,
	setEmailApiKey,
	updateEmailDelivery,
} from "@virtool/data/email/settings";
import { sendTestEmail } from "@virtool/data/email/testDelivery";
import { z } from "zod";
import { adminRole } from "../auth/policy";
import { db } from "../composition";
import { config } from "../config";

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_FIELD_LENGTH = 254;

const MAX_API_KEY_LENGTH = 256;

const addressSchema = z
	.string()
	.trim()
	.max(MAX_FIELD_LENGTH)
	.regex(EMAIL_ADDRESS_PATTERN, "Invalid email address.");

const optionalAddressSchema = z.union([z.literal(""), addressSchema]);

function toEmailSettings(settings: EmailDeliverySettings): EmailSettings {
	const { availability } = resolveEmailDelivery(
		settings,
		config.emailMasterKeys,
	);

	return {
		availability,
		enabled: settings.enabled,
		hasApiKey: settings.apiKeyEnvelope !== null,
		replyToAddress: settings.replyToAddress,
		senderAddress: settings.senderAddress,
		senderName: settings.senderName,
	};
}

/** @public */
export const getEmailSettingsFn = createServerFn({ method: "GET" })
	.middleware([adminRole("full")])
	.handler(
		async (): Promise<EmailSettings> =>
			toEmailSettings(await getEmailSettings(db)),
	);

const updateEmailSettingsSchema = z
	.object({
		enabled: z.boolean().optional(),
		replyToAddress: optionalAddressSchema.optional(),
		senderAddress: optionalAddressSchema.optional(),
		senderName: z.string().trim().max(MAX_FIELD_LENGTH).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one setting must be provided.",
	});

/** @public */
export const updateEmailSettingsFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(updateEmailSettingsSchema)
	.handler(
		async ({ data }): Promise<EmailSettings> =>
			toEmailSettings(
				await updateEmailDelivery(db, config.emailMasterKeys, data),
			),
	);

/** @public */
export const setEmailApiKeyFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(
		z.object({ apiKey: z.string().trim().min(1).max(MAX_API_KEY_LENGTH) }),
	)
	.handler(
		async ({ data }): Promise<EmailSettings> =>
			toEmailSettings(
				await setEmailApiKey(db, config.emailMasterKeys, data.apiKey),
			),
	);

/** @public */
export const clearEmailApiKeyFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.handler(
		async (): Promise<EmailSettings> =>
			toEmailSettings(await clearEmailApiKey(db)),
	);

/** @public */
export const reencryptEmailApiKeyFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.handler(
		async (): Promise<EmailReencryptResult> =>
			reencryptEmailApiKey(db, config.emailMasterKeys),
	);

/** @public */
export const sendTestEmailFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(z.object({ recipient: addressSchema }))
	.handler(
		async ({ data }): Promise<EmailTestResult> =>
			sendTestEmail(db, config.emailMasterKeys, data.recipient),
	);
