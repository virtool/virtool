import { createFakeJobNested } from "@tests/fake/jobs";
import { describe, expect, it } from "vitest";
import {
	getCreateJobStatus,
	getSubtractionFastaName,
	isJobStateUnsuccessful,
} from "../utils";

describe("getSubtractionFastaName()", () => {
	it("lowercases and replaces whitespace with underscores", () => {
		expect(getSubtractionFastaName("Arabidopsis thaliana")).toBe(
			"arabidopsis_thaliana.fa.gz",
		);
	});

	it("collapses runs of whitespace", () => {
		expect(getSubtractionFastaName("Foo  \tBar")).toBe("foo_bar.fa.gz");
	});
});

describe("isJobStateUnsuccessful()", () => {
	it.each(["cancelled", "failed"] as const)("is true for %s", (state) => {
		expect(isJobStateUnsuccessful(state)).toBe(true);
	});

	it.each(["pending", "running", "succeeded"] as const)(
		"is false for %s",
		(state) => {
			expect(isJobStateUnsuccessful(state)).toBe(false);
		},
	);

	it("is false when the state is missing", () => {
		expect(isJobStateUnsuccessful(undefined)).toBe(false);
		expect(isJobStateUnsuccessful(null)).toBe(false);
	});
});

describe("getCreateJobStatus()", () => {
	it("is null when the subtraction has no job", () => {
		expect(getCreateJobStatus(null)).toBeNull();
	});

	it("falls back to the nested job when none was fetched", () => {
		const nested = createFakeJobNested({ progress: 40, state: "running" });

		expect(getCreateJobStatus(nested)).toEqual({
			progress: 40,
			state: "running",
		});
	});

	it("prefers the fetched job while neither state is terminal", () => {
		const nested = createFakeJobNested({ progress: 40, state: "running" });

		expect(
			getCreateJobStatus(nested, { progress: 80, state: "running" }),
		).toEqual({ progress: 80, state: "running" });
	});

	it.each(["cancelled", "failed"] as const)(
		"keeps a nested %s state over a stale fetched one",
		(state) => {
			const nested = createFakeJobNested({ progress: 100, state });

			expect(
				getCreateJobStatus(nested, { progress: 40, state: "running" }),
			).toEqual({ progress: 100, state });
		},
	);
});
