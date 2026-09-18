import { mkdir } from "node:fs/promises";
import { connect } from "node:net";
import { join } from "node:path";
import { runCommand } from "./server/command.ts";
import { resolveRepository } from "./server/git.ts";
import {
	getDaemonServiceName,
	installDaemonService,
	startDaemonService,
	stopDaemonService,
} from "./server/service.ts";
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

async function ensureDaemon(
	primaryWorktree: string,
	socketPath: string,
	stateDirectory: string,
	repositoryId: string,
): Promise<void> {
	const logDirectory = join(stateDirectory, "logs");
	await mkdir(logDirectory, { mode: 0o700, recursive: true });
	const service = await installDaemonService(runCommand, {
		entry: join(primaryWorktree, "apps/dev/src/main.ts"),
		lockPath: join(stateDirectory, "daemon.lock"),
		logPath: join(logDirectory, "daemon.log"),
		node: process.execPath,
		path: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
		primaryWorktree,
		repositoryId,
		socketPath,
		stateDirectory,
	});
	if (await canConnect(socketPath)) {
		return;
	}
	await startDaemonService(runCommand, service);
	await waitForDaemon(socketPath);
}

export async function runCli(args: string[]): Promise<void> {
	if (process.platform !== "linux") {
		throw new Error("vtd supports Linux only");
	}
	const worktreeIndex = args.indexOf("--worktree");
	const cwd = worktreeIndex === -1 ? process.cwd() : args[worktreeIndex + 1];
	if (!cwd) {
		throw new Error("--worktree requires a path");
	}
	const repository = await resolveRepository(runCommand, cwd);
	const store = new StateStore(repository.stateDirectory);
	const repositoryId = store.repositoryId;
	const socketPath = join(
		runtimeDirectory(),
		"virtool-dev",
		`${store.repositoryId}.sock`,
	);
	store.close();
	const [command, subcommand, ...rest] = args;
	if (command === "daemon" && subcommand === "run") {
		if (!process.env.INVOCATION_ID) {
			throw new Error("The development daemon must be started by systemd");
		}
		const { runDaemon } = await import("./server/daemon.ts");
		const reason = await runDaemon(
			repository.primaryWorktree,
			rest[0] ?? socketPath,
		);
		if (reason === "restart") {
			process.exitCode = 75;
		}
		return;
	}
	if (command === "daemon" && subcommand === "stop") {
		await stopDaemonService(runCommand, getDaemonServiceName(repositoryId));
		return;
	}
	await ensureDaemon(
		repository.primaryWorktree,
		socketPath,
		repository.stateDirectory,
		repositoryId,
	);
	if (command === "ui") {
		process.stdout.write("https://dev.localhost:9443\n");
		return;
	}
	const supported = new Set(["list", "remove", "stop", "up"]);
	if (!command || !supported.has(command)) {
		throw new Error("Usage: vtd <up|stop|remove|list|ui|daemon stop>");
	}
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
