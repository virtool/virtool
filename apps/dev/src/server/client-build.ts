import { access } from "node:fs/promises";
import { join } from "node:path";
import type { CommandRunner } from "./command.ts";

/** Build the management client when its source has changed or output is missing. */
export async function ensureClientBuild(
	primaryWorktree: string,
	clientDirectory: string,
	clientHash: string | null,
	sourceHash: string,
	run: CommandRunner,
): Promise<void> {
	let outputExists = true;
	try {
		await access(join(clientDirectory, "index.html"));
	} catch {
		outputExists = false;
	}
	if (outputExists && clientHash === sourceHash) {
		return;
	}
	await run("pnpm", ["--filter", "@virtool/dev", "exec", "vite", "build"], {
		cwd: primaryWorktree,
	});
}
