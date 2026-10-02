import { parseArgs } from "node:util";
import {
	type AccountCredentials,
	checkAccountCredentials,
	normalizeEmail,
} from "@virtool/contracts";
import { resolveFileBacked } from "@virtool/contracts/env";
import { createDb, type Db } from "@virtool/data/db/pg";
import { users } from "@virtool/data/db/schema/users";
import { createEmitter } from "@virtool/data/events/emit";
import { getSettings } from "@virtool/data/settings/data";
import {
	createFirstAdministrator,
	FirstAdministratorExistsError,
} from "@virtool/data/users/data";
import { createLogger } from "@virtool/logger";
import { z } from "zod";

/** The outcome of an attempt to create the first administrator. */
export type CreateAdministratorResult =
	| { status: "created"; userId: number }
	| { status: "exists" };

const AdministratorEnv = z.object({
	VT_ADMINISTRATOR_PASSWORD: z.string().min(1, {
		error: "create administrator requires VT_ADMINISTRATOR_PASSWORD",
	}),
	VT_POSTGRES_URL: z.string().url(),
});

/**
 * Create a full administrator when the instance has no users.
 *
 * An instance that already has a user is left unchanged, so this can run each
 * time an environment starts. The credentials are checked only when no user
 * exists, so a setting that is not valid cannot stop an environment that has
 * users.
 */
export async function createAdministrator(
	db: Db,
	input: AccountCredentials,
): Promise<CreateAdministratorResult> {
	const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
	if (anyUser) {
		return { status: "exists" };
	}
	const { minimumPasswordLength } = await getSettings(db);
	checkAccountCredentials(input, minimumPasswordLength);
	const email = normalizeEmail(input.email);

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

/**
 * Read the `create administrator` options from `argv`.
 *
 * Give each value in the `--name=value` form. In the `--name value` form,
 * `parseArgs` rejects a value that starts with `-`.
 */
export function parseAdministratorArgs(
	argv: string[],
): Omit<AccountCredentials, "password"> {
	const { values } = parseArgs({
		args: argv,
		options: {
			email: { type: "string" },
			handle: { type: "string" },
		},
		strict: true,
	});
	if (!values.handle || !values.email) {
		throw new Error("create administrator requires --handle and --email");
	}
	return { email: values.email, handle: values.handle };
}

/**
 * Run `create administrator --handle=<handle> --email=<email>`.
 *
 * The password comes from `VT_ADMINISTRATOR_PASSWORD`, not `argv`, so it does
 * not appear in process listings or in the error of a failed command.
 */
export async function startCreateAdministrator(argv: string[]): Promise<void> {
	const env = AdministratorEnv.parse(
		resolveFileBacked(Object.keys(AdministratorEnv.shape), process.env),
	);
	const credentials = {
		...parseAdministratorArgs(argv),
		password: env.VT_ADMINISTRATOR_PASSWORD,
	};
	const logger = createLogger({ name: "dev-tools" });
	const { client, db } = createDb(
		{ postgresPoolMax: 1, postgresUrl: env.VT_POSTGRES_URL },
		"dev-tools",
	);
	createEmitter({ client, logger });

	try {
		const result = await createAdministrator(db, credentials);
		logger.info(
			{ handle: credentials.handle, ...result },
			result.status === "created"
				? "created administrator"
				: "skipped administrator because users exist",
		);
	} finally {
		await client.end();
	}
}
