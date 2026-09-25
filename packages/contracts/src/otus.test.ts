import { describe, expect, it } from "vitest";

import { SequenceCreateRequest, SequenceUpdateRequest } from "./otus";

const createFields = {
	accession: "NC_1",
	definition: "Alpha",
};

describe("SequenceCreateRequest", () => {
	it("removes whitespace and makes the sequence uppercase", () => {
		const result = SequenceCreateRequest.parse({
			...createFields,
			sequence: "atgc\nryk m\r\n\tn",
		});

		expect(result.sequence).toBe("ATGCRYKMN");
	});

	it.each(["", " \n\t", "ATGX"])("rejects the sequence %j", (sequence) => {
		expect(
			SequenceCreateRequest.safeParse({ ...createFields, sequence }).success,
		).toBe(false);
	});
});

describe("SequenceUpdateRequest", () => {
	it("normalizes a sequence that is present", () => {
		expect(SequenceUpdateRequest.parse({ sequence: "ac\ngt" }).sequence).toBe(
			"ACGT",
		);
	});

	it("leaves an absent sequence absent", () => {
		expect(SequenceUpdateRequest.parse({}).sequence).toBeUndefined();
	});
});
