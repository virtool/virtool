import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CommandRunner } from "./command.ts";

function quoteUnitValue(value: string): string {
	if (value.includes("\n") || value.includes("\0")) {
		throw new Error(
			"Systemd unit values cannot contain newlines or null bytes",
		);
	}
	return `"${value
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"')
		.replaceAll("%", "%%")}"`;
}

function escapeUnitPath(value: string): string {
	if (!value.startsWith("/")) {
		throw new Error(`Systemd service paths must be absolute: ${value}`);
	}
	let escaped = "";
	for (const byte of Buffer.from(value)) {
		const character = String.fromCharCode(byte);
		if (/[A-Za-z0-9/_.:+@-]/.test(character)) {
			escaped += character;
		} else if (character === "%") {
			escaped += "%%";
		} else {
			escaped += `\\x${byte.toString(16).padStart(2, "0")}`;
		}
	}
	return escaped;
}

/** The systemd user-service name for a repository daemon. */
export function getDaemonServiceName(repositoryId: string): string {
	return `virtool-dev-${repositoryId}.service`;
}

/** Render the systemd user unit that owns a repository daemon. */
export function renderDaemonService(options: {
	entry: string;
	lockPath: string;
	logPath: string;
	node: string;
	path: string;
	primaryWorktree: string;
	repositoryId: string;
	socketPath: string;
}): string {
	const exec = [
		"/usr/bin/flock",
		"--nonblock",
		"--no-fork",
		options.lockPath,
		options.node,
		join(options.primaryWorktree, "apps/dev/node_modules/tsx/dist/cli.mjs"),
		options.entry,
		"daemon",
		"run",
		options.socketPath,
	]
		.map(quoteUnitValue)
		.join(" ");
	return `[Unit]
Description=Virtool development daemon for ${options.repositoryId}

[Service]
Type=simple
WorkingDirectory=${escapeUnitPath(options.primaryWorktree)}
Environment=${quoteUnitValue(`PATH=${options.path}`)}
ExecStart=${exec}
Restart=on-failure
RestartSec=1s
KillMode=control-group
UMask=0077
StandardOutput=append:${escapeUnitPath(options.logPath)}
StandardError=append:${escapeUnitPath(options.logPath)}
`;
}

/** Install or refresh a repository daemon unit in the systemd user manager. */
export async function installDaemonService(
	run: CommandRunner,
	options: Parameters<typeof renderDaemonService>[0] & {
		stateDirectory: string;
	},
): Promise<string> {
	const name = getDaemonServiceName(options.repositoryId);
	const directory = `${options.stateDirectory}/systemd`;
	const unitPath = `${directory}/${name}`;
	const temporaryPath = `${unitPath}.${randomUUID()}.tmp`;
	await mkdir(directory, { mode: 0o700, recursive: true });
	await writeFile(temporaryPath, renderDaemonService(options), { mode: 0o600 });
	await rename(temporaryPath, unitPath);
	await run("systemctl", ["--user", "link", "--force", unitPath]);
	await run("systemctl", ["--user", "daemon-reload"]);
	return name;
}

/** Ask the systemd user manager to start a repository daemon. */
export async function startDaemonService(
	run: CommandRunner,
	name: string,
): Promise<void> {
	await run("systemctl", ["--user", "start", name]);
}

/** Ask the systemd user manager to stop a repository daemon. */
export async function stopDaemonService(
	run: CommandRunner,
	name: string,
): Promise<void> {
	await run("systemctl", ["--user", "stop", name]);
}
