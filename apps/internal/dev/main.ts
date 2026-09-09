import { spawn } from "node:child_process";
import { build } from "tsdown";
import { createDevProcess } from "./process.ts";

const command = process.argv[2];
if (command !== "serve" && command !== "run") {
	throw new Error("Expected serve or run; migrations must be run explicitly");
}

const service = createDevProcess(() =>
	spawn(
		process.execPath,
		["--import", "@sentry/node/preload", "dist/index.mjs", command],
		{ stdio: "inherit" },
	),
);

async function shutdown() {
	await service.stop();
	process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

await build({
	watch: true,
	onSuccess(_config, signal) {
		void service.start(signal).catch((error) => {
			process.stderr.write(`${error}\n`);
			process.exitCode = 1;
		});
	},
});
