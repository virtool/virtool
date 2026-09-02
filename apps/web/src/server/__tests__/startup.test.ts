import { execFile, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const entry = join(appDir, ".output", "server", "index.mjs");

const postgresUrl = "postgres://virtool:virtool@localhost:5432/virtool";

// The behaviour under test is a property of the production bundle: `server.ts`
// lands in an SSR chunk Nitro loads on the first request, so a parse there
// would never run at startup. Only the built server can show that the check
// does.
const BUILD_TIMEOUT = 600_000;

/** How long the built server gets to either exit or report it is listening. */
const START_TIMEOUT = 30_000;

// Each case spawns Node and waits on a real process, which the `server`
// project's 5s default does not cover.
const CASE_TIMEOUT = 60_000;

type Start = {
	code: number | null;
	output: string;
	listening: boolean;
};

// srvx suppresses its listening banner when `TEST` is set, which Vitest sets
// for this process. Inheriting it would silence the one line these cases read
// the outcome from — and quietly satisfy the assertion that it is absent.
const SUPPRESSED = new Set(["TEST", "VITEST"]);

// The `server` project injects storage variables into this process so that
// importing a server module works at all. Start from an environment with every
// Virtool variable stripped, or the case under test inherits them.
function buildEnv(overrides: Record<string, string>): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};

	for (const [key, value] of Object.entries(process.env)) {
		if (!key.startsWith("VT_") && !SUPPRESSED.has(key)) {
			env[key] = value;
		}
	}

	return { ...env, HOST: "127.0.0.1", PORT: "0", ...overrides };
}

/**
 * Run the built server until it exits or reports that it is listening.
 *
 * A server that reaches the listener is killed once it says so: the point of
 * every case here is what happens before the port binds.
 */
function start(overrides: Record<string, string>): Promise<Start> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [entry], {
			cwd: appDir,
			env: buildEnv(overrides),
		});

		let output = "";
		let settled = false;

		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error(`server neither exited nor listened:\n${output}`));
		}, START_TIMEOUT);

		function collect(chunk: Buffer): void {
			output += chunk.toString();

			if (!settled && output.includes("Listening")) {
				settled = true;
				clearTimeout(timer);
				child.kill("SIGKILL");
				resolve({ code: null, output, listening: true });
			}
		}

		child.stdout.on("data", collect);
		child.stderr.on("data", collect);

		child.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});

		child.on("exit", (code) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timer);
			resolve({ code, output, listening: false });
		});
	});
}

describe("startup validation", () => {
	beforeAll(async () => {
		await execFileAsync("pnpm", ["exec", "vite", "build"], { cwd: appDir });
	}, BUILD_TIMEOUT);

	it(
		"exits without listening when required variables are missing",
		async () => {
			const result = await start({});

			expect(result.listening).toBe(false);
			expect(result.code).toBe(1);
			expect(result.output).not.toContain("Listening");
			expect(result.output).toContain("VT_POSTGRES_URL");
			expect(result.output).toContain("VT_STORAGE_BACKEND");
			expect(result.output).toContain("invalid server configuration");
		},
		CASE_TIMEOUT,
	);

	it(
		"names the invalid key without reporting its value",
		async () => {
			const result = await start({
				VT_POSTGRES_URL: "not-a-url-sentinel",
				VT_STORAGE_BACKEND: "s3",
				VT_STORAGE_S3_BUCKET: "virtool-test",
			});

			expect(result.code).toBe(1);
			expect(result.output).toContain("VT_POSTGRES_URL");
			expect(result.output).not.toContain("not-a-url-sentinel");
		},
		CASE_TIMEOUT,
	);

	it(
		"listens when the configuration is valid",
		async () => {
			const result = await start({
				VT_POSTGRES_URL: postgresUrl,
				VT_STORAGE_BACKEND: "s3",
				VT_STORAGE_S3_BUCKET: "virtool-test",
			});

			expect(result.listening).toBe(true);
			expect(result.output).not.toContain("invalid server configuration");
		},
		CASE_TIMEOUT,
	);
});
