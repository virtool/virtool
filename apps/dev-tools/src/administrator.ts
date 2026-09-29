import { parseArgs } from "node:util";
import { checkPasswordLength } from "@virtool/contracts";
import { resolveFileBacked } from "@virtool/contracts/env";
import { isValidEmail, normalizeEmail } from "@virtool/data/auth/email";
import { isReservedHandle, isValidHandle } from "@virtool/data/auth/handle";
import { createDb, type Db } from "@virtool/data/db/pg";
import { createEmitter } from "@virtool/data/events/emit";
import { getSettings } from "@virtool/data/settings/data";
import {
	createFirstAdministrator,
	FirstAdministratorExistsError,
} from "@virtool/data/users/data";
import { createLogger } from "@virtool/logger";
import { z } from "zod";

/** The credentials for the first administrator. */
export type AdministratorInput = {
	email: string;
	handle: string;
	password: string;
};

/** The outcome of an attempt to create the first administrator. */
export type CreateAdministratorResult =
	| { status: "created"; userId: number }
	| { status: "exists" };

const AdministratorEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
});

/**
 * Create a full administrator when the instance has no users.
 *
 * An instance that already has a user is left unchanged, so this can run each
 * time an environment starts.
 */
export async function createAdministrator(
	db: Db,
	input: AdministratorInput,
): Promise<CreateAdministratorResult> {
	if (!isValidHandle(input.handle) || isReservedHandle(input.handle)) {
		throw new Error(`Invalid administrator handle "${input.handle}"`);
	}
	const email = normalizeEmail(input.email);
	if (!isValidEmail(email)) {
		throw new Error(`Invalid administrator email "${input.email}"`);
	}
	const { minimumPasswordLength } = await getSettings(db);
	checkPasswordLength(input.password, minimumPasswordLength);

	try {
		const { user } = await createFirstAdministrator(db, {
			deliveryAvailable: false,
			email,
			getVerificationUrl: () => "",
			handle: input.handle,
			password: input.password,
		});
		return { status: "created", userId: user.id };
	} catch (err) {
		if (err instanceof FirstAdministratorExistsError) {
			return { status: "exists" };
		}
		throw err;
	}
}

/** Run `create administrator --handle <handle> --email <email> --password <password>`. */
export async function startCreateAdministrator(argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			email: { type: "string" },
			handle: { type: "string" },
			password: { type: "string" },
		},
		strict: true,
	});
	if (!values.handle || !values.email || !values.password) {
		throw new Error(
			"create administrator requires --handle, --email, and --password",
		);
	}
	const env = AdministratorEnv.parse(
		resolveFileBacked(Object.keys(AdministratorEnv.shape), process.env),
	);
	const logger = createLogger({ name: "dev-tools" });
	const { client, db } = createDb(
		{ postgresPoolMax: 1, postgresUrl: env.VT_POSTGRES_URL },
		"dev-tools",
	);
	createEmitter({ client, logger });

	try {
		const result = await createAdministrator(db, {
			email: values.email,
			handle: values.handle,
			password: values.password,
		});
		logger.info(
			{ handle: values.handle, ...result },
			result.status === "created"
				? "created administrator"
				: "skipped administrator because users exist",
		);
	} finally {
		await client.end();
	}
}
