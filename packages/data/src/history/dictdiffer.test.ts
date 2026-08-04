import { describe, expect, it } from "vitest";
import { type DiffEntry, diff, patch, swap } from "./dictdiffer";

/**
 * The shape this module actually patches: an OTU document as Python stores it,
 * after a JSONB round trip.
 */
const otuBefore = {
	id: 1,
	name: "Cucumber mosaic virus",
	isolates: [
		{
			id: 10,
			source_name: "A",
			source_type: "isolate",
			sequences: [{ id: "seq1", definition: "one", sequence: "ATGC" }],
		},
	],
};

const otuAfter = {
	id: 1,
	name: "Cucumber mosaic virus",
	isolates: [
		{
			id: 10,
			source_name: "B",
			source_type: "isolate",
			sequences: [
				{ id: "seq1", definition: "one", sequence: "ATGC" },
				{ id: "seq2", definition: "two", sequence: "GGGG" },
			],
		},
		{
			id: 11,
			source_name: "C",
			source_type: "isolate",
			sequences: [],
		},
	],
};

// Produced by Python `dictdiffer.diff(otuBefore, otuAfter)`, as it would be
// read back out of `legacy_history_diff.diff`.
const otuDiff: DiffEntry[] = [
	["change", ["isolates", 0, "source_name"], ["A", "B"]],
	[
		"add",
		["isolates", 0, "sequences"],
		[[1, { id: "seq2", definition: "two", sequence: "GGGG" }]],
	],
	[
		"add",
		"isolates",
		[
			[
				1,
				{
					id: 11,
					source_name: "C",
					source_type: "isolate",
					sequences: [],
				},
			],
		],
	],
];

describe("swap", () => {
	it("turns add into remove with the changes reversed", () => {
		expect(
			swap([
				[
					"add",
					"a",
					[
						[0, "x"],
						[1, "y"],
					],
				],
			]),
		).toEqual([
			[
				"remove",
				"a",
				[
					[1, "y"],
					[0, "x"],
				],
			],
		]);
	});

	it("turns remove into add with the changes unchanged", () => {
		expect(
			swap([
				[
					"remove",
					"a",
					[
						[0, "x"],
						[1, "y"],
					],
				],
			]),
		).toEqual([
			[
				"add",
				"a",
				[
					[0, "x"],
					[1, "y"],
				],
			],
		]);
	});

	it("swaps before and after on change", () => {
		expect(swap([["change", "a.b", [1, 2]]])).toEqual([
			["change", "a.b", [2, 1]],
		]);
	});

	it("does not mutate the diff it is given", () => {
		const diff: DiffEntry[] = [
			[
				"add",
				"a",
				[
					[0, "x"],
					[1, "y"],
				],
			],
		];

		swap(diff);

		expect(diff).toEqual([
			[
				"add",
				"a",
				[
					[0, "x"],
					[1, "y"],
				],
			],
		]);
	});

	it("throws on an unknown action", () => {
		expect(() => swap([["merge", "a", []]])).toThrow(
			"Unknown dictdiffer action: merge",
		);
	});
});

describe("patch", () => {
	describe("add", () => {
		it("inserts at an index in a list", () => {
			expect(patch([["add", ["a"], [[0, "x"]]]], { a: ["y"] })).toEqual({
				a: ["x", "y"],
			});
		});

		it("assigns a key on an object", () => {
			expect(patch([["add", "a", [["d", 3]]]], { a: { b: 1 } })).toEqual({
				a: { b: 1, d: 3 },
			});
		});

		it("inserts every pair of a multi-item add", () => {
			expect(
				patch(
					[
						[
							"add",
							"a",
							[
								[1, 2],
								[2, 3],
								[3, 4],
							],
						],
					],
					{ a: [1] },
				),
			).toEqual({ a: [1, 2, 3, 4] });
		});
	});

	describe("remove", () => {
		it("splices an index out of a list", () => {
			expect(patch([["remove", "a", [[1, 2]]]], { a: [1, 2, 3] })).toEqual({
				a: [1, 3],
			});
		});

		it("deletes a key from an object", () => {
			expect(
				patch([["remove", "a", [["c", 2]]]], { a: { b: 1, c: 2 } }),
			).toEqual({ a: { b: 1 } });
		});
	});

	describe("change", () => {
		it("assigns at a nested object key", () => {
			expect(patch([["change", "a.b", [1, 2]]], { a: { b: 1 } })).toEqual({
				a: { b: 2 },
			});
		});

		it("assigns at a list index given as a number", () => {
			expect(patch([["change", ["a", 1], [2, 9]]], { a: [1, 2, 3] })).toEqual({
				a: [1, 9, 3],
			});
		});

		it("coerces a numeric string segment when the parent is a list", () => {
			expect(patch([["change", "a.0", [1, 5]]], { a: [1, 2] })).toEqual({
				a: [5, 2],
			});
		});

		it("assigns at the root when the path is a single segment", () => {
			expect(patch([["change", "a", [1, 2]]], { a: 1 })).toEqual({ a: 2 });
		});
	});

	describe("paths", () => {
		it("accepts a dot-joined string path through a list", () => {
			expect(
				patch([["change", "a.b.0.c", [1, 2]]], { a: { b: [{ c: 1 }] } }),
			).toEqual({ a: { b: [{ c: 2 }] } });
		});

		it("accepts an array path through a list", () => {
			expect(
				patch([["change", ["a", "b", 0, "c"], [1, 2]]], {
					a: { b: [{ c: 1 }] },
				}),
			).toEqual({ a: { b: [{ c: 2 }] } });
		});

		it("resolves an empty string path to the root document", () => {
			expect(patch([["add", "", [["x", 1]]]], { a: 1 })).toEqual({
				a: 1,
				x: 1,
			});
		});

		it("resolves an empty array path to the root document", () => {
			expect(patch([["remove", [], [["a", 1]]]], { a: 1, b: 2 })).toEqual({
				b: 2,
			});
		});
	});

	it("does not mutate the destination", () => {
		const destination = { a: { b: [1, 2] } };

		patch(
			[
				["change", ["a", "b", 0], [1, 9]],
				["add", ["a", "b"], [[2, 3]]],
			],
			destination,
		);

		expect(destination).toEqual({ a: { b: [1, 2] } });
	});

	it("throws on an unknown action", () => {
		expect(() => patch([["merge", "a", []]], { a: 1 })).toThrow(
			"Unknown dictdiffer action: merge",
		);
	});
});

describe("patch(swap(diff))", () => {
	it("recovers a scalar change", () => {
		const diff: DiffEntry[] = [["change", "a.b", [1, 2]]];

		expect(patch(swap(diff), { a: { b: 2 } })).toEqual({ a: { b: 1 } });
	});

	it("recovers a multi-item list add", () => {
		const diff: DiffEntry[] = [
			[
				"add",
				"a",
				[
					[1, 2],
					[2, 3],
					[3, 4],
				],
			],
		];

		expect(patch(swap(diff), { a: [1, 2, 3, 4] })).toEqual({ a: [1] });
	});

	it("recovers an object key add and remove", () => {
		const diff: DiffEntry[] = [
			["add", "a", [["d", 3]]],
			["remove", "a", [["c", 2]]],
		];

		expect(patch(swap(diff), { a: { b: 1, d: 3 } })).toEqual({
			a: { b: 1, c: 2 },
		});
	});

	it("recovers an OTU document with nested isolates and sequences", () => {
		expect(patch(swap(otuDiff), otuAfter)).toEqual(otuBefore);
	});

	it("leaves the OTU document it patched untouched", () => {
		const clone = structuredClone(otuAfter);

		patch(swap(otuDiff), otuAfter);

		expect(otuAfter).toEqual(clone);
	});
});

describe("diff", () => {
	describe("change", () => {
		it("reports a changed scalar at the root", () => {
			expect(diff({ a: "b" }, { a: "c" })).toEqual([
				["change", "a", ["b", "c"]],
			]);
		});

		it("reports nothing when the documents are equal", () => {
			expect(diff({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toEqual([]);
		});

		it("reports a changed scalar at a list index", () => {
			expect(diff({ a: [1, 2] }, { a: [1, 9] })).toEqual([
				["change", ["a", 1], [2, 9]],
			]);
		});

		it("reports the whole value when a container changes type", () => {
			expect(diff({ a: { b: 1 } }, { a: [1] })).toEqual([
				["change", "a", [{ b: 1 }, [1]]],
			]);
		});

		it("reports a change against null", () => {
			expect(diff({ a: null }, { a: 1 })).toEqual([["change", "a", [null, 1]]]);
		});
	});

	describe("add and remove", () => {
		it("reports an added key at the root", () => {
			expect(diff({}, { a: { b: "c" } })).toEqual([
				["add", "", [["a", { b: "c" }]]],
			]);
		});

		it("reports a removed key", () => {
			expect(diff({ a: 1, b: 2 }, { a: 1 })).toEqual([
				["remove", "", [["b", 2]]],
			]);
		});

		it("groups every appended list item into one entry", () => {
			expect(diff({ fruits: [] }, { fruits: ["apple", "mango"] })).toEqual([
				[
					"add",
					"fruits",
					[
						[0, "apple"],
						[1, "mango"],
					],
				],
			]);
		});

		it("reports truncated list items highest index first", () => {
			expect(diff({ a: [1, 2, 3] }, { a: [1] })).toEqual([
				[
					"remove",
					"a",
					[
						[2, 3],
						[1, 2],
					],
				],
			]);
		});
	});

	describe("paths", () => {
		it("dot-joins a path of plain string keys", () => {
			expect(diff({ a: { x: 1 } }, { a: { x: 2 } })).toEqual([
				["change", "a.x", [1, 2]],
			]);
		});

		it("keeps a list path when any key is an index", () => {
			expect(diff({ a: [{ b: 1 }] }, { a: [{ b: 2 }] })).toEqual([
				["change", ["a", 0, "b"], [1, 2]],
			]);
		});

		it("keeps a list path when a key contains a dot", () => {
			expect(diff({ "a.b": 1 }, { "a.b": 2 })).toEqual([
				["change", ["a.b"], [1, 2]],
			]);
		});
	});

	it("deep-copies the values it reports", () => {
		const first = { a: { b: 1 } };
		const second = { a: { b: 1 }, c: { d: 2 } };
		const result = diff(first, second);

		second.c.d = 3;

		expect(result).toEqual([["add", "", [["c", { d: 2 }]]]]);
	});

	it("matches the diff Python wrote for an OTU edit", () => {
		expect(diff(otuBefore, otuAfter)).toEqual(otuDiff);
	});
});

describe("round trip", () => {
	function expectRoundTrip(before: unknown, after: unknown): void {
		const result = diff(before, after);

		expect(patch(result, before)).toEqual(after);
		expect(patch(swap(result), after)).toEqual(before);
	}

	it("round trips a nested object", () => {
		expectRoundTrip(
			{ a: { b: { c: 1, d: "x" } }, e: true },
			{ a: { b: { c: 2, d: "x" } }, e: false },
		);
	});

	it("round trips an added object key", () => {
		expectRoundTrip({ a: { b: 1 } }, { a: { b: 1, c: 2 } });
	});

	it("round trips a removed object key", () => {
		expectRoundTrip({ a: { b: 1, c: 2 } }, { a: { b: 1 } });
	});

	it("round trips a value change", () => {
		expectRoundTrip({ a: "before" }, { a: "after" });
	});

	it("round trips an appended list of objects", () => {
		expectRoundTrip(
			{ sequences: [{ id: "seq1" }] },
			{ sequences: [{ id: "seq1" }, { id: "seq2" }, { id: "seq3" }] },
		);
	});

	it("round trips a truncated list of objects", () => {
		expectRoundTrip(
			{ sequences: [{ id: "seq1" }, { id: "seq2" }, { id: "seq3" }] },
			{ sequences: [{ id: "seq1" }] },
		);
	});

	it("round trips an OTU edit", () => {
		expectRoundTrip(otuBefore, otuAfter);
	});

	it("round trips an OTU revert", () => {
		expectRoundTrip(otuAfter, otuBefore);
	});
});
