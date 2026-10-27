import { mkdir, rm } from "node:fs/promises";
import { connect, createServer, type Server, Socket } from "node:net";
import { dirname } from "node:path";

/** A request carried over the repository-scoped Unix control socket. */
export type ControlRequest = {
	command: "list" | "remove" | "shutdown" | "stop" | "up";
	worktree?: string;
};

function readRequest(
	socket: Socket,
	handle: (request: ControlRequest) => Promise<unknown>,
): void {
	let input = "";
	let handled = false;
	socket.setEncoding("utf8");
	function fail(error: unknown): void {
		handled = true;
		socket.end(
			`${JSON.stringify({ error: error instanceof Error ? error.message : String(error), ok: false })}\n`,
		);
	}
	socket.on("data", (chunk) => {
		if (handled) {
			return;
		}
		input += chunk;
		const newline = input.indexOf("\n");
		if (newline === -1) {
			return;
		}
		handled = true;
		let request: ControlRequest;
		try {
			const value = JSON.parse(input.slice(0, newline)) as unknown;
			if (!isControlRequest(value)) {
				throw new Error("Invalid control request");
			}
			request = value;
		} catch (error) {
			fail(error);
			return;
		}
		void handle(request).then(
			(result) => socket.end(`${JSON.stringify({ ok: true, result })}\n`),
			(error) =>
				socket.end(
					`${JSON.stringify({ error: error instanceof Error ? error.message : String(error), ok: false })}\n`,
				),
		);
	});
	socket.on("end", () => {
		if (!handled && input.length > 0) {
			fail(new Error("Control request ended before newline"));
		}
	});
}

function isControlRequest(value: unknown): value is ControlRequest {
	if (!value || typeof value !== "object") {
		return false;
	}
	const request = value as Record<string, unknown>;
	return (
		["list", "remove", "shutdown", "stop", "up"].includes(
			request.command as string,
		) &&
		(request.worktree === undefined || typeof request.worktree === "string")
	);
}

export async function createControlServer(
	path: string,
	handle: (request: ControlRequest) => Promise<unknown>,
): Promise<Server> {
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	const server = createServer((socket) => readRequest(socket, handle));
	await listenOnUnixSocket(server, path);
	return server;
}

/** Listen on a Unix socket after removing it only when no server owns it. */
export async function listenOnUnixSocket(
	server: Pick<Server, "listen" | "off" | "once">,
	path: string,
): Promise<void> {
	if (await hasSocketListener(path)) {
		throw new Error(`Socket is already in use: ${path}`);
	}
	await rm(path, { force: true });
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(path, () => {
			server.off("error", reject);
			resolve();
		});
	});
}

async function hasSocketListener(path: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		const socket = connect(path);
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "ECONNREFUSED" || error.code === "ENOENT") {
				resolve(false);
			} else {
				reject(error);
			}
		});
	});
}

export async function sendControlRequest(
	path: string,
	request: ControlRequest,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const socket = new Socket();
		let output = "";
		socket.setEncoding("utf8");
		socket.once("error", reject);
		socket.on("data", (chunk) => {
			output += chunk;
		});
		socket.on("end", () => {
			const response = JSON.parse(output) as {
				error?: string;
				ok: boolean;
				result?: unknown;
			};
			if (response.ok) {
				resolve(response.result);
			} else {
				reject(new Error(response.error ?? "Daemon request failed"));
			}
		});
		socket.connect(path, () => socket.write(`${JSON.stringify(request)}\n`));
	});
}
