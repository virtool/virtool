#!/usr/bin/env node
import { runCli } from "./cli.ts";

try {
	await runCli(process.argv.slice(2));
} catch (error) {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
}
