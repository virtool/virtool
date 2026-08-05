import { describe, expect, it } from "vitest";
import { WorkflowError } from "./errors";
import { assertSerializableData } from "./serializable";

describe("assertSerializableData", () => {
	// The shape a real `buildContext` returns: nested objects, arrays, nulls and
	// numbers, all of which survive the round trip untouched.
	it("accepts a plain nested object", () => {
		expect(() =>
			assertSerializableData({
				sample: {
					id: "abc123",
					name: "Sample 1",
					paired: true,
					reads: [
						{ name: "reads_1.fq.gz", size: 4096 },
						{ name: "reads_2.fq.gz", size: 4098 },
					],
				},
				subtractions: [],
				library: null,
			}),
		).not.toThrow();
	});

	it("rejects a function", () => {
		expect(() => assertSerializableData({ load: () => "reads" })).toThrow(
			WorkflowError,
		);
		expect(() => assertSerializableData({ load: () => "reads" })).toThrow(
			/load: function did not survive/,
		);
	});

	it("rejects a class instance", () => {
		class Reference {
			constructor(readonly id: string) {}

			path(): string {
				return `/references/${this.id}`;
			}
		}

		expect(() =>
			assertSerializableData({ reference: new Reference("ref") }),
		).toThrow(/reference: Reference became object/);
	});

	it("rejects a Date", () => {
		expect(() =>
			assertSerializableData({ job: { createdAt: new Date(0) } }),
		).toThrow(/job\.createdAt: Date became/);
	});

	it("names every offending path", () => {
		expect(() =>
			assertSerializableData({
				a: new Date(0),
				b: { c: () => {} },
			}),
		).toThrow(/a: Date became.*b\.c: function did not survive/s);
	});

	it("rejects a value that cannot be JSON-encoded at all", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		expect(() => assertSerializableData(circular)).toThrow(
			/could not be JSON-encoded/,
		);
	});

	it("rejects an undefined value nested in an array", () => {
		expect(() => assertSerializableData({ reads: [undefined] })).toThrow(
			/reads\[0\]: undefined became null/,
		);
	});
});
