import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureClientBuild } from "./client-build.ts";
import type { CommandRunner } from "./command.ts";

const directories: string[] = [];

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

async function createClientOutput(): Promise<{
	clientDirectory: string;
	primaryWorktree: string;
}> {
	const primaryWorktree = await mkdtemp(join(tmpdir(), "virtool-dev-client-"));
	directories.push(primaryWorktree);
	const clientDirectory = join(primaryWorktree, "apps/dev/dist/client");
	await mkdir(clientDirectory, { recursive: true });
	await writeFile(join(clientDirectory, "index.html"), "");
	return { clientDirectory, primaryWorktree };
}

describe("ensureClientBuild", () => {
	it("rebuilds an existing client after source changes", async () => {
		const { clientDirectory, primaryWorktree } = await createClientOutput();
		const run = vi
			.fn<CommandRunner>()
			.mockResolvedValue({ stderr: "", stdout: "" });

		await ensureClientBuild(
			primaryWorktree,
			clientDirectory,
			"previous-hash",
			"current-hash",
			run,
		);

		expect(run).toHaveBeenCalledWith(
			"pnpm",
			["--filter", "@virtool/dev", "exec", "vite", "build"],
			{ cwd: primaryWorktree },
		);
	});

	it("reuses an existing client when source is unchanged", async () => {
		const { clientDirectory, primaryWorktree } = await createClientOutput();
		const run = vi.fn<CommandRunner>();

		await ensureClientBuild(
			primaryWorktree,
			clientDirectory,
			"current-hash",
			"current-hash",
			run,
		);

		expect(run).not.toHaveBeenCalled();
	});
});
