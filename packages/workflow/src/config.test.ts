import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWorkflowRunConfig, type WorkflowRunConfig } from "./config";
import { WorkflowError } from "./errors";

function writeSecret(contents: string): string {
	const path = join(mkdtempSync(join(tmpdir(), "vt-workflow-env-")), "value");
	writeFileSync(path, contents);
	return path;
}

/** The smallest environment that parses. */
function minimalEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
	return {
		VT_JOBS_API_URL: "http://api-jobs-service:9950",
		VT_WORKFLOW: "pathoscope",
		VT_WORK_PATH: "/work",
		...overrides,
	};
}

describe("parseWorkflowRunConfig", () => {
	it("reads every key from the environment", () => {
		const config = parseWorkflowRunConfig(
			minimalEnv({
				VT_MEM: "16",
				VT_PROC: "8",
				VT_TIMEOUT: "60",
				VT_SENTRY_DSN: "https://key@sentry.example/1",
				VT_IMAGE: "ghcr.io/virtool/ts-pathoscope:1.2.3",
			}),
		);

		expect(config).toEqual({
			jobsApiUrl: "http://api-jobs-service:9950",
			mem: 16,
			proc: 8,
			workflow: "pathoscope",
			workPath: "/work",
			timeout: 60,
			sentryDsn: "https://key@sentry.example/1",
			image: "ghcr.io/virtool/ts-pathoscope:1.2.3",
		});
	});

	// The defaults Python's CLI declares, kept so a runner started without them
	// behaves the same as the one it replaces.
	it("applies Python's defaults for the optional keys", () => {
		const config = parseWorkflowRunConfig(minimalEnv());

		expect(config.mem).toBe(4);
		expect(config.proc).toBe(2);
		expect(config.timeout).toBe(1000);
		expect(config.image).toBe("unknown");
		expect(config.sentryDsn).toBeUndefined();
	});

	// Every key, not a sample of them: a key missing from the resolver's list
	// silently loses its file variant and reads only the plain environment.
	it.each<[string, string, keyof WorkflowRunConfig, unknown]>([
		[
			"VT_JOBS_API_URL",
			"http://from-file:9950",
			"jobsApiUrl",
			"http://from-file:9950",
		],
		["VT_MEM", "32", "mem", 32],
		["VT_PROC", "16", "proc", 16],
		["VT_WORKFLOW", "nuvs", "workflow", "nuvs"],
		["VT_WORK_PATH", "/from-file", "workPath", "/from-file"],
		["VT_TIMEOUT", "42", "timeout", 42],
		[
			"VT_SENTRY_DSN",
			"https://key@sentry.example/2",
			"sentryDsn",
			"https://key@sentry.example/2",
		],
		[
			"VT_IMAGE",
			"ghcr.io/virtool/ts-nuvs:2.0.0",
			"image",
			"ghcr.io/virtool/ts-nuvs:2.0.0",
		],
	])("resolves %s from its _FILE variant", (key, written, field, expected) => {
		const env = minimalEnv({ [`${key}_FILE`]: writeSecret(written) });

		delete env[key];

		expect(parseWorkflowRunConfig(env)[field]).toBe(expected);
	});

	// A rollout moving to a secrets-store mount can still carry the stale env var
	// from the `Secret` it replaces.
	it("prefers the file over a plain variable of the same name", () => {
		const config = parseWorkflowRunConfig(
			minimalEnv({
				VT_JOBS_API_URL: "http://stale:9950",
				VT_JOBS_API_URL_FILE: writeSecret("http://current:9950"),
			}),
		);

		expect(config.jobsApiUrl).toBe("http://current:9950");
	});

	it("throws naming the key and path when a _FILE path cannot be read", () => {
		expect(() =>
			parseWorkflowRunConfig(
				minimalEnv({ VT_WORK_PATH_FILE: "/nonexistent/work-path" }),
			),
		).toThrow(/VT_WORK_PATH_FILE points at \/nonexistent\/work-path/);
	});

	it("treats an empty file as an unset value", () => {
		const config = parseWorkflowRunConfig(
			minimalEnv({ VT_IMAGE_FILE: writeSecret("   ") }),
		);

		expect(config.image).toBe("unknown");
	});

	// Python defaults this to `https://localhost:9950`, which in a pod silently
	// polls nothing.
	it("throws when VT_JOBS_API_URL is missing", () => {
		const env = minimalEnv();

		delete env.VT_JOBS_API_URL;

		expect(() => parseWorkflowRunConfig(env)).toThrow(WorkflowError);
		expect(() => parseWorkflowRunConfig(env)).toThrow(/VT_JOBS_API_URL/);
	});

	// Python defaults this to the relative path `temp`, and `createWorkPath`
	// deletes whatever it points at.
	it("throws when VT_WORK_PATH is missing", () => {
		const env = minimalEnv();

		delete env.VT_WORK_PATH;

		expect(() => parseWorkflowRunConfig(env)).toThrow(/VT_WORK_PATH/);
	});

	it("throws when VT_WORKFLOW names a workflow that does not exist", () => {
		expect(() =>
			parseWorkflowRunConfig(minimalEnv({ VT_WORKFLOW: "not_a_workflow" })),
		).toThrow(/VT_WORKFLOW/);
	});

	it.each(["0", "-1", "2.5", "many"])("throws when VT_PROC is %s", (value) => {
		expect(() =>
			parseWorkflowRunConfig(minimalEnv({ VT_PROC: value })),
		).toThrow(/VT_PROC/);
	});

	// Deployment tooling routinely injects an empty string for a value it has
	// nothing to put in. Coercing that would make VT_MEM zero.
	it("treats an empty plain variable as unset", () => {
		const config = parseWorkflowRunConfig(minimalEnv({ VT_MEM: "" }));

		expect(config.mem).toBe(4);
	});
});
