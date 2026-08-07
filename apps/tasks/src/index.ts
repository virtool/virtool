import { createLogger } from "@virtool/logger";
import { bootstrap } from "./bootstrap";
import { SERVICE } from "./instrument";
import { APP_VERSION } from "./version";

/**
 * The tasks process.
 *
 * One binary carries both halves of Virtool's task system: the periodic
 * spawner, which inserts the scheduled tasks, and the runner, which claims and
 * executes them. Each is turned off independently — `VT_TASKS_SPAWN_ENABLED`
 * and `VT_TASKS_CLAIM_ENABLED`, both defaulting to `true` — which is what
 * decouples their rollouts without needing two images. The cutover from Python
 * is one deployment that starts with claiming off, and one flag flip.
 *
 * Both halves are placeholders here. This build starts, serves its probes and
 * shuts down cleanly; the spawn schedule and the claim loop land with the
 * issues that own them.
 */
async function main(): Promise<void> {
	const context = await bootstrap({ version: APP_VERSION });

	if (context.config.spawnEnabled) {
		context.logger.info("periodic task spawning is enabled");
	}

	if (context.config.claimEnabled) {
		context.logger.info("task claiming is enabled");
	}
}

try {
	await main();
} catch (err) {
	// The logger `bootstrap` builds may not exist yet — a bad `VT_POSTGRES_URL`
	// fails the config parse before anything else is constructed — so this
	// reports through one of its own. `process.exitCode` rather than
	// `process.exit()`, so the line above actually reaches stdout.
	createLogger({ name: SERVICE }).fatal({ err }, "failed to start");
	process.exitCode = 1;
}
