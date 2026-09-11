import { createLogger } from "@virtool/logger";

// Load only the selected process so migration Jobs do not initialize services.
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
		case "data-migrations": {
			const { startDataMigrations } = await import("./data-migrations/main");
			await startDataMigrations(process.argv.slice(3));
			return;
		}
		default:
			throw new Error(
				`unknown command ${command ? `"${command}"` : "(none)"}; expected one of serve, run, migrate, data-migrations`,
			);
	}
}

try {
	await dispatch(process.argv[2]);
} catch (err) {
	createLogger({ name: "internal" }).fatal({ err }, "failed to start");
	process.exitCode = 1;
}
