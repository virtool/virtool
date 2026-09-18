import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, renameSync, statSync } from "node:fs";
import { access, type FileHandle, open, realpath, rm } from "node:fs/promises";
import { connect } from "node:net";
import { join } from "node:path";
import { runCommand } from "./server/command.ts";
import { resolveRepository } from "./server/git.ts";
import { type ControlRequest, sendControlRequest } from "./server/socket.ts";
import { StateStore } from "./server/state.ts";

function runtimeDirectory(): string {
	return (
		process.env.XDG_RUNTIME_DIR ??
		`/tmp/virtool-dev-${process.getuid?.() ?? "user"}`
	);
}

async function canConnect(path: string): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect(path);
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => resolve(false));
	});
}

async function waitForDaemon(path: string): Promise<void> {
	for (let attempt = 0; attempt < 1_200; attempt += 1) {
		if (await canConnect(path)) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error("Development daemon did not start");
}

async function acquireDaemonLock(path: string): Promise<FileHandle | null> {
	try {
		const lock = await open(path, "wx", 0o600);
		await lock.writeFile(String(process.pid));
		return lock;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") {
			return null;
		}
		throw error;
	}
}

function openDaemonLog(stateDirectory: string): number {
	const directory = join(stateDirectory, "logs");
	mkdirSync(directory, { mode: 0o700, recursive: true });
	const path = join(directory, "daemon.log");
	try {
		if (statSync(path).size > 5 * 1024 * 1024) {
			renameSync(path, join(directory, "daemon.previous.log"));
		}
	} catch {
		// The first daemon start has no log to rotate.
	}
	return openSync(path, "a", 0o600);
}

async function ensureDaemon(
	primaryWorktree: string,
	socketPath: string,
	stateDirectory: string,
): Promise<void> {
	if (await canConnect(socketPath)) {
		return;
	}
	const lockPath = join(stateDirectory, "daemon.lock");
	const lock = await acquireDaemonLock(lockPath);
	if (!lock) {
		await waitForDaemon(socketPath);
		return;
	}
	try {
		if (await canConnect(socketPath)) {
			return;
		}
		await rm(socketPath, { force: true });
		const entry = join(primaryWorktree, "apps/dev/src/main.ts");
		await access(entry);
		const log = openDaemonLog(stateDirectory);
		const child = spawn(
			"pnpm",
			[
				"--dir",
				primaryWorktree,
				"--filter",
				"@virtool/dev",
				"exec",
				"tsx",
				entry,
				"daemon",
				"run",
				socketPath,
			],
			{ detached: true, stdio: ["ignore", log, log] },
		);
		closeSync(log);
		child.unref();
		await waitForDaemon(socketPath);
	} finally {
		await lock.close();
		await rm(lockPath, { force: true });
	}
}

export async function runCli(args: string[]): Promise<void> {
	if (process.platform !== "linux") {
		throw new Error("virtool-dev supports Linux only");
	}
	const cwd = await realpath(process.env.OLDPWD ?? process.cwd());
	const repository = await resolveRepository(runCommand, cwd);
	const store = new StateStore(repository.stateDirectory);
	const socketPath = join(
		runtimeDirectory(),
		"virtool-dev",
		`${store.repositoryId}.sock`,
	);
	store.close();
	const [command, subcommand, ...rest] = args;
	if (command === "daemon" && subcommand === "run") {
		const { runDaemon } = await import("./server/daemon.ts");
		await runDaemon(repository.primaryWorktree, rest[0] ?? socketPath);
		return;
	}
	if (command === "daemon" && subcommand === "stop") {
		await sendControlRequest(socketPath, { command: "shutdown" });
		return;
	}
	await ensureDaemon(
		repository.primaryWorktree,
		socketPath,
		repository.stateDirectory,
	);
	if (command === "ui") {
		process.stdout.write("https://dev.localhost:9443\n");
		return;
	}
	const supported = new Set(["list", "remove", "stop", "up"]);
	if (!command || !supported.has(command)) {
		throw new Error("Usage: virtool-dev <up|stop|remove|list|ui|daemon stop>");
	}
	const worktreeIndex = args.indexOf("--worktree");
	const worktree = worktreeIndex === -1 ? cwd : args[worktreeIndex + 1];
	const result = await sendControlRequest(socketPath, {
		command: command as ControlRequest["command"],
		worktree,
	});
	if (command === "list") {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write("https://dev.localhost:9443\n");
	}
}
