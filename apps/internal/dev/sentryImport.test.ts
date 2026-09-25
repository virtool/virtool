import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";

const appRoot = join(import.meta.dirname, "..");

const launchers = [
	join(appRoot, "../../Dockerfile"),
	join(appRoot, "dev/main.ts"),
	join(appRoot, "dev/entrypoint.sh"),
];

async function getImportSpecifiers(): Promise<string[]> {
	const contents = await Promise.all(
		launchers.map((path) => readFile(path, "utf8")),
	);

	return contents.flatMap((content) =>
		[...content.matchAll(/--import"?,?\s*"?(@sentry\/[^"\s,]+)/g)].map(
			(match) => match[1] as string,
		),
	);
}

test("every launcher preloads the same Sentry hook", async () => {
	const specifiers = await getImportSpecifiers();

	expect(specifiers).toHaveLength(launchers.length);
	expect(new Set(specifiers).size).toBe(1);
});

// A Sentry upgrade that drops the hook's export stops every process at launch.
test("the Sentry hook loads before postgres", async () => {
	const [specifier] = await getImportSpecifiers();

	await expect(
		promisify(execFile)(
			process.execPath,
			[
				"--import",
				specifier as string,
				"--input-type=module",
				"-e",
				"await import('postgres')",
			],
			{ cwd: appRoot },
		),
	).resolves.toBeDefined();
});
