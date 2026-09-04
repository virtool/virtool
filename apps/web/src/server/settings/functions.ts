import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	MAX_UPLOAD_SIZE,
	type SampleGroup,
	type Settings,
	sampleGroups,
} from "@virtool/contracts";
import {
	getSettings,
	type Settings as StoredSettings,
	updateSettings,
} from "@virtool/data/settings/data";
import {
	clearNcbiApiKey,
	NcbiConfigurationError,
	resolveNcbiApiKey,
	setNcbiApiKey,
} from "@virtool/data/settings/ncbi";
import { z } from "zod";
import { adminRole, open } from "../auth/policy";
import { db, keyring } from "../composition";
import { ClientError } from "../errors";

/** The password rules a client needs to validate a new password before submitting it. */
export type PasswordPolicy = {
	minimumPasswordLength: number;
};

/**
 * Reduce the stored settings to what may cross the wire.
 *
 * Both settings functions answer any administrator holding the `settings` role,
 * so returning the row as stored would put the NCBI API-key envelope in a
 * browser payload. Narrowing here rather than in the data layer keeps the
 * redaction on the transport boundary, where the row is published.
 *
 * The email columns are stripped as well: they belong to the full-administrator
 * email functions, and the API-key envelope must never reach a `settings`-role
 * client even encrypted.
 */
function toSettings({
	emailApiKey: _emailApiKey,
	emailEnabled: _emailEnabled,
	emailReplyToAddress: _emailReplyToAddress,
	emailSenderAddress: _emailSenderAddress,
	emailSenderName: _emailSenderName,
	ncbiApiKey,
	...rest
}: StoredSettings): Settings {
	return {
		...rest,
		hasNcbiApiKey: ncbiApiKey !== null,
		ncbiAvailability: resolveNcbiApiKey(ncbiApiKey, keyring).availability,
	};
}

function rethrowAsHttp(err: unknown): never {
	if (err instanceof NcbiConfigurationError) {
		setResponseStatus(400);
		throw new ClientError(err.message, 400);
	}

	throw err;
}

/**
 * Password policy server function. Unauthenticated by necessity — the
 * forced-reset and first-user forms both set a password before any session
 * exists, and they can only apply the configured minimum if they can read it.
 *
 * It returns the minimum length alone rather than the settings row. The rest of
 * that row is instance configuration that no unauthenticated caller has any
 * business reading.
 */
export const getPasswordPolicyFn = createServerFn({ method: "GET" })
	.middleware([open()])
	.handler(async (): Promise<PasswordPolicy> => {
		const { minimumPasswordLength } = await getSettings(db);
		return { minimumPasswordLength };
	});

/**
 * The longest NCBI API key accepted.
 *
 * NCBI issues a 36-character hexadecimal key today. The bound is generous
 * rather than exact so a format change does not lock administrators out of
 * saving one, and exists only to stop an unbounded string reaching the column.
 */
const MAX_NCBI_API_KEY_LENGTH = 128;

const updateSettingsSchema = z
	.object({
		cacheStorageBudget: z.number().int().positive().optional(),
		defaultSourceTypes: z.array(z.string()).optional(),
		enableSentry: z.boolean().optional(),
		maxUploadSize: z.number().int().positive().max(MAX_UPLOAD_SIZE).optional(),
		minimumPasswordLength: z.number().int().min(1).optional(),
		sampleAllRead: z.boolean().optional(),
		sampleAllWrite: z.boolean().optional(),
		sampleGroup: z
			.string()
			.refine(
				(value): value is SampleGroup =>
					(sampleGroups as readonly string[]).includes(value),
				{ message: "Invalid sample group." },
			)
			.optional(),
		sampleGroupRead: z.boolean().optional(),
		sampleGroupWrite: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one setting must be provided.",
	});

export const getSettingsFn = createServerFn({ method: "GET" })
	.middleware([adminRole("settings")])
	.handler(async (): Promise<Settings> => toSettings(await getSettings(db)));

export const updateSettingsFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(updateSettingsSchema)
	.handler(
		async ({ data }): Promise<Settings> =>
			toSettings(await updateSettings(db, data)),
	);

/**
 * Store a new NCBI API key, replacing whatever is stored.
 *
 * A credential, so it has its own function rather than a field on
 * {@link updateSettingsFn}: the write goes through the keyring, and a plain
 * settings patch has no encryption key to hand.
 */
export const setNcbiApiKeyFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(
		z.object({
			// Trimmed, so a pasted key carrying whitespace is stored as the key
			// itself.
			apiKey: z.string().trim().min(1).max(MAX_NCBI_API_KEY_LENGTH),
		}),
	)
	.handler(async ({ data }): Promise<Settings> => {
		try {
			return toSettings(await setNcbiApiKey(db, keyring, data.apiKey));
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const clearNcbiApiKeyFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.handler(
		async (): Promise<Settings> => toSettings(await clearNcbiApiKey(db)),
	);
