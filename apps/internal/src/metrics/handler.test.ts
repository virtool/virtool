import { createLogger } from "@virtool/logger";
import { describe, expect, it, vi } from "vitest";
import {
	type MetricsSource,
	type ScrapeMetricsOptions,
	scrapeMetrics,
} from "./handler";

const TOKEN = "a-metrics-token";

function source(overrides: Partial<MetricsSource> = {}): MetricsSource {
	return {
		name: "test",
		refresh: vi.fn(() => Promise.resolve()),
		clear: vi.fn(),
		...overrides,
	};
}

function scrape(
	overrides: Partial<ScrapeMetricsOptions> = {},
): ReturnType<typeof scrapeMetrics> {
	return scrapeMetrics({
		authorization: `Bearer ${TOKEN}`,
		token: TOKEN,
		logger: createLogger({ name: "test", level: "silent" }),
		sources: [],
		contentType: "text/plain; version=0.0.4",
		render: () => Promise.resolve("rendered"),
		...overrides,
	});
}

describe("scrapeMetrics", () => {
	it("answers 404 without refreshing when no token is configured", async () => {
		const refreshed = source();

		const response = await scrape({ token: undefined, sources: [refreshed] });

		expect(response.status).toBe(404);
		expect(refreshed.refresh).not.toHaveBeenCalled();
	});

	it("answers 401 without refreshing to a wrong token", async () => {
		const refreshed = source();

		const response = await scrape({
			authorization: "Bearer wrong",
			sources: [refreshed],
		});

		expect(response).toEqual({
			status: 401,
			body: "Unauthorized",
			headers: { "www-authenticate": "Bearer" },
		});
		expect(refreshed.refresh).not.toHaveBeenCalled();
	});

	it("refreshes every source and renders", async () => {
		const first = source();
		const second = source();

		const response = await scrape({ sources: [first, second] });

		expect(response).toEqual({
			status: 200,
			body: "rendered",
			headers: { "content-type": "text/plain; version=0.0.4" },
		});
		expect(first.refresh).toHaveBeenCalledOnce();
		expect(second.refresh).toHaveBeenCalledOnce();
		expect(first.clear).not.toHaveBeenCalled();
	});

	it("clears only the source whose refresh fails", async () => {
		const failed = source({
			refresh: () => Promise.reject(new Error("postgres is down")),
		});
		const healthy = source();

		const response = await scrape({ sources: [failed, healthy] });

		expect(response.status).toBe(200);
		expect(failed.clear).toHaveBeenCalledOnce();
		expect(healthy.clear).not.toHaveBeenCalled();
	});
});
