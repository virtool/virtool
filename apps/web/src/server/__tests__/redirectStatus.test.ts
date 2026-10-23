import { redirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setResponseStatus } = vi.hoisted(() => ({
	setResponseStatus: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus }));

const { redirectStatusMiddleware } = await import("../redirectStatus");

type RequestFn = (options: {
	handlerType: "router" | "serverFn";
	next: () => Promise<{ response: Response }>;
}) => Promise<{ response: Response }>;

const run = redirectStatusMiddleware.options.server as unknown as RequestFn;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("redirectStatusMiddleware", () => {
	it("sets the status of a page redirect", async () => {
		const response = redirect({ to: "/login" });

		const result = await run({
			handlerType: "router",
			next: async () => ({ response }),
		});

		expect(result.response).toBe(response);
		expect(setResponseStatus).toHaveBeenCalledWith(307);
	});

	it("leaves a rendered page alone", async () => {
		await run({
			handlerType: "router",
			next: async () => ({ response: new Response("<html></html>") }),
		});

		expect(setResponseStatus).not.toHaveBeenCalled();
	});

	it("leaves a server-function redirect alone", async () => {
		const response = redirect({ to: "/login" });

		const result = await run({
			handlerType: "serverFn",
			next: async () => ({ response }),
		});

		expect(result.response).toBe(response);
		expect(setResponseStatus).not.toHaveBeenCalled();
	});
});
