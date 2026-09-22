import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { CommandRunner } from "./command.ts";
import {
	getDaemonServiceName,
	installDaemonService,
	renderDaemonService,
} from "./service.ts";

const directories: string[] = [];

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

const options = {
	entry: "/repo/apps/dev/src/main.ts",
	lockPath: "/state/daemon.lock",
	node: "/usr/bin/node",
	path: "/usr/bin:/bin",
	primaryWorktree: "/repo",
	repositoryId: "repository-id",
	socketPath: "/run/user/1000/virtool-dev/repository.sock",
};

it("renders a foreground service with systemd and lifetime lock ownership", () => {
	const unit = renderDaemonService(options);

	expect(unit).toContain("Type=simple");
	expect(unit).toContain("WorkingDirectory=/repo");
	expect(unit).toContain('ExecStart="/usr/bin/flock" "--nonblock" "--no-fork"');
	expect(unit).toContain('"daemon" "run"');
	expect(unit).toContain("Restart=on-failure");
	expect(unit).toContain("UMask=0077");
	expect(unit).toContain("StandardOutput=journal");
	expect(unit).toContain("StandardError=journal");
	expect(unit).not.toContain("--daemonize");
});

it("escapes directive paths without quoting them", () => {
	const unit = renderDaemonService({
		...options,
		primaryWorktree: "/repo worktree",
	});

	expect(unit).toContain("WorkingDirectory=/repo\\x20worktree");
	expect(unit).not.toContain('WorkingDirectory="');
});

it("installs and reloads the repository service", async () => {
	const stateDirectory = await mkdtemp(join(tmpdir(), "virtool-dev-service-"));
	directories.push(stateDirectory);
	const run = vi
		.fn<CommandRunner>()
		.mockResolvedValue({ stderr: "", stdout: "" });
	const name = await installDaemonService(run, {
		...options,
		stateDirectory,
	});
	const unitPath = join(stateDirectory, "systemd", name);

	expect(name).toBe(getDaemonServiceName(options.repositoryId));
	expect(await readFile(unitPath, "utf8")).toContain("Restart=on-failure");
	expect(run).toHaveBeenNthCalledWith(1, "systemctl", [
		"--user",
		"link",
		"--force",
		unitPath,
	]);
	expect(run).toHaveBeenNthCalledWith(2, "systemctl", [
		"--user",
		"daemon-reload",
	]);
});
