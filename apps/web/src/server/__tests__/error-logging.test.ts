import {
	CLIENT_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { debug, error, warn } = vi.hoisted(() => ({
	debug: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => new Request("https://virtool.test/refs"),
}));

vi.mock("../logger", () => ({
	logger: { debug, error, warn },
}));

const { databaseUnavailableMiddleware, errorLoggingMiddleware } = await import(
	"../error-logging"
);
const { ClientError } = await import("../errors");

type ServerFn = (options: {
	next: () => Promise<unknown>;
	serverFnMeta: { name: string };
}) => Promise<unknown>;

const run = errorLoggingMiddleware.options.server as unknown as ServerFn;

function call(thrown: unknown): Promise<unknown> {
	return run({
		next: () => Promise.reject(thrown),
		serverFnMeta: { name: "getAccountFn" },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("errorLoggingMiddleware", () => {
	it.each([
		UNAUTHORIZED_ERROR_NAME,
		FORBIDDEN_ERROR_NAME,
		PASSWORD_RESET_REQUIRED_ERROR_NAME,
		SETUP_REQUIRED_ERROR_NAME,
	])("logs a %s without its error object or stack", async (name) => {
		const thrown = Object.assign(new Error("credential details"), { name });

		await expect(call(thrown)).rejects.toBe(thrown);

		expect(debug).toHaveBeenCalledWith(
			{ errorName: name, path: "/refs", serverFn: "getAccountFn" },
			"server function rejected request",
		);
		expect(error).not.toHaveBeenCalled();
	});

	it("logs a 4xx ClientError at debug", async () => {
		const thrown = new ClientError("Sample not found.", 404);

		await expect(call(thrown)).rejects.toBe(thrown);

		expect(debug).toHaveBeenCalledWith(
			{ err: thrown, path: "/refs", serverFn: "getAccountFn", status: 404 },
			"server function rejected request",
		);
		expect(error).not.toHaveBeenCalled();
	});

	it("logs a 5xx ClientError at error", async () => {
		const thrown = new ClientError("Could not reach NCBI.", 502);

		await expect(call(thrown)).rejects.toBe(thrown);

		expect(error).toHaveBeenCalledWith(
			{ err: thrown, path: "/refs", serverFn: "getAccountFn" },
			"unhandled server function error",
		);
		expect(debug).not.toHaveBeenCalled();
	});

	it("retains the full error and cause chain for an unexpected failure", async () => {
		const cause = new Error("database unavailable");
		const thrown = new Error("query failed", { cause });

		await expect(call(thrown)).rejects.toBe(thrown);

		expect(error).toHaveBeenCalledWith(
			{ err: thrown, path: "/refs", serverFn: "getAccountFn" },
			"unhandled server function error",
		);
		expect(debug).not.toHaveBeenCalled();
	});

	it("rethrows an unreachable database as a 503 ClientError and logs a warning", async () => {
		const thrown = new Error("query failed", {
			cause: { code: "CONNECT_TIMEOUT" },
		});
		const rejected = await call(thrown).catch((err: unknown) => err);

		expect(rejected).toMatchObject({ name: CLIENT_ERROR_NAME, status: 503 });
		expect(warn).toHaveBeenCalledWith(
			{ err: thrown, path: "/refs", serverFn: "getAccountFn" },
			"database unavailable",
		);
		expect(error).not.toHaveBeenCalled();
	});
});

type RequestFn = (options: {
	next: () => Promise<unknown>;
	pathname: string;
}) => Promise<unknown>;

const runRequest = databaseUnavailableMiddleware.options
	.server as unknown as RequestFn;

describe("databaseUnavailableMiddleware", () => {
	it("answers an unreachable database with a 503 and logs a warning", async () => {
		const thrown = new Error("query failed", {
			cause: { code: "CONNECT_TIMEOUT" },
		});

		const response = (await runRequest({
			next: () => Promise.reject(thrown),
			pathname: "/api/v1/uploads",
		})) as Response;

		expect(response.status).toBe(503);
		expect(response.headers.get("retry-after")).toBe("5");
		expect(warn).toHaveBeenCalledWith(
			{ err: thrown, path: "/api/v1/uploads" },
			"database unavailable",
		);
	});

	it("rethrows any other failure", async () => {
		const thrown = new Error("boom");

		await expect(
			runRequest({
				next: () => Promise.reject(thrown),
				pathname: "/api/v1/uploads",
			}),
		).rejects.toBe(thrown);
		expect(warn).not.toHaveBeenCalled();
	});
});
