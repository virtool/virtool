import { mkdtemp, rm } from "node:fs/promises";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createControlServer } from "./socket.ts";

const directories: string[] = [];

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

function sendRaw(path: string, request: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const socket = new Socket();
		let response = "";
		socket.setEncoding("utf8");
		socket.once("error", reject);
		socket.on("data", (chunk) => {
			response += chunk;
		});
		socket.on("end", () => resolve(response));
		socket.connect(path, () => socket.end(request));
	});
}

it("rejects malformed requests without stopping the control server", async () => {
	const directory = await mkdtemp(join(tmpdir(), "virtool-dev-socket-"));
	directories.push(directory);
	const path = join(directory, "control.sock");
	const handle = vi.fn(async () => ({ accepted: true }));
	const server = await createControlServer(path, handle);

	const malformed = JSON.parse(await sendRaw(path, "not-json\n"));
	const valid = JSON.parse(
		await sendRaw(path, `${JSON.stringify({ command: "list" })}\n`),
	);

	expect(malformed).toMatchObject({ ok: false });
	expect(valid).toEqual({ ok: true, result: { accepted: true } });
	expect(handle).toHaveBeenCalledTimes(1);
	await new Promise<void>((resolve) => server.close(() => resolve()));
});
