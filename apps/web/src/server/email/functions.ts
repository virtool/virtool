import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import type { EmailSettings, EmailTestResult } from "@virtool/contracts";
import {
	clearEmailApiKey,
	EmailConfigurationError,
	type EmailDeliverySettings,
	getEmailSettings,
	resolveEmailDelivery,
	setEmailApiKey,
	updateEmailDelivery,
} from "@virtool/data/email/settings";
import { sendTestEmail } from "@virtool/data/email/testDelivery";
import { z } from "zod";
import { adminRole } from "../auth/policy";
import { db, keyring } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_FIELD_LENGTH = 254;

const MAX_API_KEY_LENGTH = 256;

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

const senderNameSchema = z
	.string()
	.trim()
	.max(MAX_FIELD_LENGTH)
	.refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), {
		message: "Sender name cannot contain control characters.",
	});

const addressSchema = z
	.string()
	.trim()
	.max(MAX_FIELD_LENGTH)
	.regex(EMAIL_ADDRESS_PATTERN, "Invalid email address.");

const optionalAddressSchema = z.union([z.literal(""), addressSchema]);

function rethrowAsHttp(err: unknown): never {
	if (err instanceof EmailConfigurationError) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}
	throw err;
}

function toEmailSettings(settings: EmailDeliverySettings): EmailSettings {
	const { availability } = resolveEmailDelivery(settings, keyring);

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
		senderName: senderNameSchema.optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one setting must be provided.",
	});

/** @public */
export const updateEmailSettingsFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(updateEmailSettingsSchema)
	.handler(async ({ data }): Promise<EmailSettings> => {
		try {
			return toEmailSettings(await updateEmailDelivery(db, keyring, data));
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

/** @public */
export const setEmailApiKeyFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(
		z.object({ apiKey: z.string().trim().min(1).max(MAX_API_KEY_LENGTH) }),
	)
	.handler(async ({ data }): Promise<EmailSettings> => {
		try {
			return toEmailSettings(await setEmailApiKey(db, keyring, data.apiKey));
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

/** @public */
export const clearEmailApiKeyFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.handler(
		async (): Promise<EmailSettings> =>
			toEmailSettings(await clearEmailApiKey(db)),
	);

/** @public */
export const sendTestEmailFn = createServerFn({ method: "POST" })
	.middleware([adminRole("full")])
	.validator(z.object({ recipient: addressSchema }))
	.handler(
		async ({ data }): Promise<EmailTestResult> =>
			sendTestEmail(db, keyring, logger, data.recipient),
	);
