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

const updateSettingsSchema = z
	.object({
		defaultSourceTypes: z.array(z.string()).optional(),
		enableApi: z.boolean().optional(),
		enableSentry: z.boolean().optional(),
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
	.handler(async (): Promise<Settings> => getSettings(db));

export const updateSettingsFn = createServerFn({ method: "POST" })
	.middleware([adminRole("settings")])
	.validator(updateSettingsSchema)
	.handler(async ({ data }): Promise<Settings> => updateSettings(db, data));
