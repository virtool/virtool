import { describe, expect, it } from "vitest";

import {
	normalizeSequence,
	SEQUENCE_PATTERN,
	SequenceCreateRequest,
	SequenceUpdateRequest,
} from "./otus";

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

describe("normalizeSequence", () => {
	it.each([
		["atgc", "ATGC"],
		["AT GC", "ATGC"],
		["at\r\ngc\n", "ATGC"],
		["\tatgc ", "ATGC"],
		["", ""],
	])("normalizes %j to %j", (sequence, expected) => {
		expect(normalizeSequence(sequence)).toBe(expected);
	});
});

describe("SEQUENCE_PATTERN", () => {
	it.each(["ATCG", "NRYKM", ""])("accepts %j", (sequence) => {
		expect(SEQUENCE_PATTERN.test(sequence)).toBe(true);
	});

	// Lowercase is accepted only once it is normalized.
	it.each(["atcg", "ATGX", "AT GC", "U"])("rejects %j", (sequence) => {
		expect(SEQUENCE_PATTERN.test(sequence)).toBe(false);
	});
});
