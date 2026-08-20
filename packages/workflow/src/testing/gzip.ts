/**
 * A `pigz` that does not spawn.
 *
 * `gzipFile` and `gunzipFile` shell out, and a step that gzips its output is
 * almost always tested by reading that output back. The default fake runner
 * reports a silent success and writes nothing, which turns every such
 * assertion into one about an empty file, so this stands in a real `node:zlib`
 * round trip instead.
 *
 * It is registered on the runner `createFakeBuildContextInput` builds, because
 * every workflow image carries `pigz` and a fake context stands for one of
 * those. Register it by hand on a runner a test supplies itself.
 */

import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import type { RunSubprocessOptions } from "../subprocess/types";
import type { FakeSubprocessRunner } from "./subprocess";

const gunzipAsync = promisify(gunzip);
const gzipAsync = promisify(gzip);

/** Teach `runner` to answer `pigz` by actually compressing the file. */
export function registerFakePigz(runner: FakeSubprocessRunner): void {
	runner.register("pigz", { effect: runFakePigz });
}

async function runFakePigz({
	command,
	stdoutFile,
}: RunSubprocessOptions): Promise<void> {
	const source = command.at(-1);

	if (source === undefined || stdoutFile === undefined) {
		throw new Error(`Fake pigz cannot run \`${command.join(" ")}\``);
	}

	const contents = await readFile(source);

	await writeFile(
		stdoutFile,
		command.includes("-d")
			? await gunzipAsync(contents)
			: await gzipAsync(contents),
	);
}
