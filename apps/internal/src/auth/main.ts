import { resolveFileBacked } from "@virtool/contracts/env";
import { createDb } from "@virtool/data/db/pg";
import { createLogger } from "@virtool/logger";
import { z } from "zod";
import { runAuthCommand } from "./command";

/**
 * The name this entrypoint reports under, in logs and in `application_name`.
 *
 * Its own name rather than `migrate`: this is a one-shot administrative run
 * that reads and rewrites identities, and telling it apart from the schema
 * migration it follows is the point of the distinction.
 */
const SERVICE = "auth";

/*
 A schema of its own, like `migrate`. This command needs a database and nothing
 else — no storage credentials, no probe port, no shutdown budget — so the Job
 that runs it carries only what it uses.
*/
const AuthEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
});

/** Every environment key this entrypoint reads. */
const AUTH_ENV_KEYS: string[] = Object.keys(AuthEnv.shape);

/**
 * Audit or migrate legacy identities — the `auth` subcommand.
 *
 * A function rather than module-scope side effects so the merged binary's
 * dispatcher decides when it runs, and so importing this module costs nothing.
 */
export async function startAuth(argv: readonly string[]): Promise<void> {
	const logger = createLogger({ name: SERVICE });

	let env: z.infer<typeof AuthEnv>;

	try {
		env = AuthEnv.parse(resolveFileBacked(AUTH_ENV_KEYS, process.env));
	} catch (err) {
		logger.fatal({ err }, "failed to read configuration");
		process.exitCode = 1;
		return;
	}

	// One connection: the run is serial by construction, and a pool would leave
	// idle backends open for the length of a scan.
	const { client, db } = createDb(
		{ postgresUrl: env.VT_POSTGRES_URL, postgresPoolMax: 1 },
		SERVICE,
	);

	try {
		process.exitCode = await runAuthCommand(db, logger, argv);
	} finally {
		await client.end();
	}
}
