import { createLogger } from "@virtool/logger";

/**
 * The merged internal binary's command dispatcher.
 *
 * One image carries three processes that share a schema, a data layer and an
 * object store but not a lifecycle: `serve` is the jobs API HTTP server, scaled
 * to N request replicas; `run` is the spawner-and-runner pair, a lease
 * singleton; `migrate` applies pending Drizzle migrations as an init Job. They
 * stay separate containers so HTTP scaling never multiplies task-lease
 * contention — the image is fused, the processes are not.
 *
 * The command's module is loaded with a dynamic `import` rather than a static
 * one so only the selected process's graph is evaluated: the migration Job
 * never imports Hono, and the HTTP server never imports the task registry. Each
 * `start*` owns its own fatal logging under its own service name, so this
 * dispatcher only has to report an unknown command and a `serve` failure.
 */
async function dispatch(command: string | undefined): Promise<void> {
	switch (command) {
		case "serve": {
			const { startServe } = await import("./serve/main");
			startServe();
			return;
		}
		case "run": {
			const { startRun } = await import("./run/main");
			await startRun();
			return;
		}
		case "migrate": {
			const { startMigrate } = await import("./migrate/main");
			await startMigrate();
			return;
		}
		default:
			throw new Error(
				`unknown command ${command ? `"${command}"` : "(none)"}; expected one of serve, run, migrate`,
			);
	}
}

try {
	await dispatch(process.argv[2]);
} catch (err) {
	createLogger({ name: "internal" }).fatal({ err }, "failed to start");
	process.exitCode = 1;
}
