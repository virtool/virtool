import { describe, expect, it } from "vitest";

import { buildApplicationName } from "./applicationName";

const MAX_LENGTH = 63;

describe("buildApplicationName", () => {
	it("keeps a short hostname readable", () => {
		expect(buildApplicationName("web", "virtool-web-7d9f8b6c5d-x2ktp")).toBe(
			"virtool-ts-web@virtool-web-7d9f8b6c5d-x2ktp",
		);
	});

	it("stays within the length Postgres stores", () => {
		const name = buildApplicationName("jobs-api", "h".repeat(200));

		expect(Buffer.byteLength(name)).toBeLessThanOrEqual(MAX_LENGTH);
	});

	it("keeps replicas distinct when hostnames differ only in their suffix", () => {
		const prefix = "virtool-web-with-a-very-long-deployment-name-7d9f8b6c5d-";

		expect(buildApplicationName("web", `${prefix}x2ktp`)).not.toBe(
			buildApplicationName("web", `${prefix}q7bnf`),
		);
	});

	it("is stable for a given service and hostname", () => {
		const host = "h".repeat(200);

		expect(buildApplicationName("web", host)).toBe(
			buildApplicationName("web", host),
		);
	});

	// The two services share a database, and on a developer machine they share a
	// hostname too. Without a distinct name each would count the other's backends
	// in `pg_stat_activity` and both would report the sum.
	it("keeps two services on one host apart", () => {
		const host = "localhost";

		expect(buildApplicationName("web", host)).not.toBe(
			buildApplicationName("jobs-api", host),
		);
	});

	// The digest fallback replaces the hostname only. A long hostname must not
	// collapse two services onto one name.
	it("keeps two services apart when the hostname is digested", () => {
		const host = "h".repeat(200);

		expect(buildApplicationName("web", host)).not.toBe(
			buildApplicationName("jobs-api", host),
		);
	});

	it("keeps the service segment legible when the hostname is digested", () => {
		expect(buildApplicationName("jobs-api", "h".repeat(200))).toMatch(
			/^virtool-ts-jobs-api@/,
		);
	});
});
