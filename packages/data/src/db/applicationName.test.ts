import { describe, expect, it } from "vitest";

import { buildApplicationName } from "./applicationName";

const MAX_LENGTH = 63;

describe("buildApplicationName", () => {
	it("keeps a short hostname readable", () => {
		expect(buildApplicationName("virtool-web-7d9f8b6c5d-x2ktp")).toBe(
			"virtool-ts@virtool-web-7d9f8b6c5d-x2ktp",
		);
	});

	it("stays within the length Postgres stores", () => {
		const name = buildApplicationName("h".repeat(200));

		expect(Buffer.byteLength(name)).toBeLessThanOrEqual(MAX_LENGTH);
	});

	it("keeps replicas distinct when hostnames differ only in their suffix", () => {
		const prefix = "virtool-web-with-a-very-long-deployment-name-7d9f8b6c5d-";

		expect(buildApplicationName(`${prefix}x2ktp`)).not.toBe(
			buildApplicationName(`${prefix}q7bnf`),
		);
	});

	it("is stable for a given hostname", () => {
		const host = "h".repeat(200);

		expect(buildApplicationName(host)).toBe(buildApplicationName(host));
	});
});
