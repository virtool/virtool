/**
 * A `pigz` that does not spawn.
 *
 * `gzipFile` shells out, and a step that gzips its output is almost always
 * tested by reading that output back — against a runner that writes nothing,
 * every such assertion is about a file that is not there.
 *
 * `recompressBzip2File` gets the same treatment. Node has no bzip2 codec, so
 * its fake reads the source as the bytes the real pipe would decompress.
 */

import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import type { RunSubprocessOptions } from "../subprocess/types";
import type { FakeSubprocessRunner } from "./subprocess";

const gzipAsync = promisify(gzip);

/** Teach `runner` to answer `pigz` calls by actually compressing the file. */
export function registerFakePigz(runner: FakeSubprocessRunner): void {
	runner.register("pigz", { effect: runFakePigz });
	runner.register(isBzip2Recompression, { effect: runFakeRecompression });
}

function isBzip2Recompression(command: readonly string[]): boolean {
	return command[0] === "bash" && Boolean(command[2]?.includes("lbzip2"));
}

async function runFakeRecompression({
	command,
	stdoutFile,
}: RunSubprocessOptions): Promise<void> {
	const source = command[4];

	if (source === undefined || stdoutFile === undefined) {
		throw new Error(`Fake recompression cannot run \`${command.join(" ")}\``);
	}

	await writeFile(stdoutFile, await gzipAsync(await readFile(source)));
}

async function runFakePigz({
	command,
	stdoutFile,
}: RunSubprocessOptions): Promise<void> {
	const source = command.at(-1);

	if (source === undefined || stdoutFile === undefined) {
		throw new Error(`Fake pigz cannot run \`${command.join(" ")}\``);
	}

	await writeFile(stdoutFile, await gzipAsync(await readFile(source)));
}
