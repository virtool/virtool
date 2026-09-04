import { resolveFileBacked } from "@virtool/contracts/env";
import { createDb } from "@virtool/data/db/pg";
import { createLogger } from "@virtool/logger";
import { z } from "zod";
import { runAuthCommand } from "./command";

const SERVICE = "auth";

const AuthEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
});

const AUTH_ENV_KEYS: string[] = Object.keys(AuthEnv.shape);

/** Run the legacy identity audit or migration subcommand. */
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
