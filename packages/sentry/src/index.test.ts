import { describe, expect, it } from "vitest";
import { getCommonOptions, type SentrySamplingContext } from "./index";

function sample(
	attributes: Record<string, unknown> | undefined,
	inherited?: number,
): number {
	const context: SentrySamplingContext = {
		attributes,
		inheritOrSampleWith: (fallback) => inherited ?? fallback,
	};

	return getCommonOptions("web").tracesSampler(context);
}

describe("tracesSampler", () => {
	it.each(["/health/live", "/health/ready"])("drops %s", (path) => {
		expect(sample({ "url.path": path })).toBe(0);
	});

	it("drops a probe even when an incoming trace was sampled", () => {
		expect(sample({ "url.path": "/health/live" }, 1)).toBe(0);
	});

	it("samples /jobs/counts at a low flat rate", () => {
		expect(sample({ "url.path": "/jobs/counts" })).toBe(0.01);
	});

	it("does not match a path by prefix", () => {
		expect(sample({ "url.path": "/health/liveness" })).toBe(1);
		expect(sample({ "url.path": "/jobs/counts/extra" })).toBe(1);
	});

	it("falls back to the default rate for any other path", () => {
		expect(sample({ "url.path": "/samples" })).toBe(1);
	});

	it("falls back to the default rate for a span carrying no path", () => {
		expect(sample({})).toBe(1);
		expect(sample(undefined)).toBe(1);
	});

	it("inherits an incoming trace's decision for an unmatched path", () => {
		expect(sample({ "url.path": "/samples" }, 0.4)).toBe(0.4);
	});
});
