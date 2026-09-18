import { beforeEach, describe, expect, it, vi } from "vitest";

const { debug, error, getResponseStatus } = vi.hoisted(() => ({
	debug: vi.fn(),
	error: vi.fn(),
	getResponseStatus: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => new Request("https://virtool.test/refs"),
	getResponseStatus,
}));

vi.mock("../logger", () => ({
	logger: { debug, error },
}));

const { errorLoggingMiddleware } = await import("../error-logging");

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
		[401, "UnauthorizedError"],
		[403, "ForbiddenError"],
	])(
		"logs a %i rejection without its error object or stack",
		async (status, name) => {
			const thrown = Object.assign(new Error("credential details"), { name });
			getResponseStatus.mockReturnValue(status);

			await expect(call(thrown)).rejects.toBe(thrown);

			expect(debug).toHaveBeenCalledWith(
				{
					errorName: name,
					path: "/refs",
					serverFn: "getAccountFn",
					status,
				},
				"server function rejected request",
			);
			expect(error).not.toHaveBeenCalled();
		},
	);

	it("retains the full error and cause chain for an unexpected failure", async () => {
		const cause = new Error("database unavailable");
		const thrown = new Error("query failed", { cause });
		getResponseStatus.mockReturnValue(500);

		await expect(call(thrown)).rejects.toBe(thrown);

		expect(error).toHaveBeenCalledWith(
			{
				err: thrown,
				path: "/refs",
				serverFn: "getAccountFn",
				status: 500,
			},
			"unhandled server function error",
		);
		expect(debug).not.toHaveBeenCalled();
	});
});
