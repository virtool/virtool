import { createServerFn } from "@tanstack/react-start";
import {
	type SampleGroup,
	sampleGroups,
} from "@virtool/data/db/schema/settings";
import {
	getSettings,
	type Settings,
	updateSettings,
} from "@virtool/data/settings/data";
import { z } from "zod";
import { adminRole, open } from "../auth/policy";
import { db } from "../composition";

/** The password rules a client needs to validate a new password before submitting it. */
export type PasswordPolicy = {
	minimumPasswordLength: number;
};

/**
 * The instance settings as a client sees them.
 *
 * Every stored setting except the NCBI API key, which is a credential and is
 * reported only as whether one is configured. A client writes the key and never
 * reads it back.
 */
export type PublicSettings = Omit<Settings, "ncbiApiKey"> & {
	hasNcbiApiKey: boolean;
};

/**
 * Reduce the stored settings to what may cross the wire.
 *
 * Both settings functions answer any administrator holding the `settings` role,
 * so returning the row as stored would put the NCBI API key in a browser
 * payload. Narrowing here rather than in the data layer keeps the redaction on
 * the transport boundary, where the row is published.
 */
function toPublicSettings({ ncbiApiKey, ...rest }: Settings): PublicSettings {
	return { ...rest, hasNcbiApiKey: ncbiApiKey !== "" };
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
		defaultSourceTypes: z.array(z.string()).optional(),
		enableSentry: z.boolean().optional(),
		minimumPasswordLength: z.number().int().min(1).optional(),
		// Trimmed, so a pasted key carrying whitespace is stored as the key
		// itself. Empty is how a key is cleared, and is what the request layer
		// reads as unset.
		ncbiApiKey: z.string().trim().max(MAX_NCBI_API_KEY_LENGTH).optional(),
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
	.handler(
		async (): Promise<PublicSettings> =>
			toPublicSettings(await getSettings(db)),
	);

export const updateSettingsFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(updateSettingsSchema)
	.handler(
		async ({ data }): Promise<PublicSettings> =>
			toPublicSettings(await updateSettings(db, data)),
	);
