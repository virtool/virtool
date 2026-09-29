import * as Sentry from "@sentry/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "./command";

vi.mock("@sentry/node", () => ({
	init: vi.fn(),
	captureException: vi.fn(),
	flush: vi.fn(async () => true),
	logger: {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
	},
}));

const DSN = "https://public@sentry.example.com/1";

beforeEach(() => {
	process.exitCode = undefined;
});

afterEach(() => {
	process.exitCode = undefined;
	vi.clearAllMocks();
});

describe("runCommand", () => {
	it("does not initialise Sentry without a DSN", async () => {
		const run = vi.fn(async () => {});

		await runCommand({
			service: "migrate",
			failure: "failed",
			parseEnv: () => ({ VT_SENTRY_DSN: undefined }),
			run,
		});

		expect(run).toHaveBeenCalledOnce();
		expect(Sentry.init).not.toHaveBeenCalled();
		expect(Sentry.flush).not.toHaveBeenCalled();
		expect(process.exitCode).toBeUndefined();
	});

	it("initialises Sentry with the service tag and flushes on success", async () => {
		await runCommand({
			service: "data-migrations",
			failure: "failed",
			parseEnv: () => ({ VT_SENTRY_DSN: DSN }),
			run: async () => {},
		});

		expect(Sentry.init).toHaveBeenCalledWith(
			expect.objectContaining({
				dsn: DSN,
				dist: "data-migrations",
				initialScope: { tags: { service: "data-migrations" } },
			}),
		);
		expect(Sentry.flush).toHaveBeenCalledOnce();
		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(process.exitCode).toBeUndefined();
	});

	it("reports a thrown error, flushes, and exits non-zero", async () => {
		const error = new Error("boom");

		await runCommand({
			service: "migrate",
			failure: "failed",
			parseEnv: () => ({ VT_SENTRY_DSN: DSN }),
			run: async () => {
				throw error;
			},
		});

		expect(Sentry.captureException).toHaveBeenCalledWith(error);
		expect(Sentry.flush).toHaveBeenCalledOnce();
		expect(process.exitCode).toBe(1);
	});

	it("exits non-zero without running when the environment is invalid", async () => {
		const run = vi.fn(async () => {});

		await runCommand({
			service: "migrate",
			failure: "failed",
			parseEnv: () => {
				throw new Error("VT_POSTGRES_URL is required");
			},
			run,
		});

		expect(run).not.toHaveBeenCalled();
		expect(Sentry.init).not.toHaveBeenCalled();
		expect(process.exitCode).toBe(1);
	});
});
