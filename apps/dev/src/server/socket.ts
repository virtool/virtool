import { mkdir, rm } from "node:fs/promises";
import { createServer, type Server, Socket } from "node:net";
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
	socket.setEncoding("utf8");
	socket.on("data", (chunk) => {
		input += chunk;
		const newline = input.indexOf("\n");
		if (newline === -1) {
			return;
		}
		const request = JSON.parse(input.slice(0, newline)) as ControlRequest;
		void handle(request).then(
			(result) => socket.end(`${JSON.stringify({ ok: true, result })}\n`),
			(error) =>
				socket.end(
					`${JSON.stringify({ error: error instanceof Error ? error.message : String(error), ok: false })}\n`,
				),
		);
	});
}

export async function createControlServer(
	path: string,
	handle: (request: ControlRequest) => Promise<unknown>,
): Promise<Server> {
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	await rm(path, { force: true });
	const server = createServer((socket) => readRequest(socket, handle));
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(path, resolve);
	});
	return server;
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
