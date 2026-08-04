import { describe, expect, it } from "vitest";
import {
	compareBySegment,
	groupSequencesIntoSegments,
	readSchemaNames,
	type SegmentedSequence,
	type SegmentGroup,
	segmentDepths,
} from "./segments";

/**
 * A sequence of the given length whose depths are filled with `marker`, so a
 * group's contents can be identified by what came out of it.
 */
function sequence(
	length: number,
	marker: number,
	segment: string | null = null,
): SegmentedSequence {
	return {
		depths: new Array<number>(length).fill(marker),
		length,
		segment,
	};
}

type Group = SegmentGroup<SegmentedSequence> | undefined;

const empty: SegmentGroup<SegmentedSequence> = {
	declaredLength: 0,
	isolates: [],
	key: "",
	name: null,
};

// The markers each group collected, one entry per contributing isolate.
function markers(group: Group): number[][] {
	return segmentDepths(group ?? empty).map((entry) => [...new Set(entry)]);
}

function depthsOf(group: Group): number[][] {
	return segmentDepths(group ?? empty);
}

describe("readSchemaNames", () => {
	it("reads the declared segment names in schema order", () => {
		expect(
			readSchemaNames({
				schema: [
					{ molecule: "ssRNA", name: "L", required: true },
					{ molecule: "ssRNA", name: "S", required: false },
				],
			}),
		).toEqual(["L", "S"]);
	});

	it("reads an absent or malformed schema as declaring nothing", () => {
		expect(readSchemaNames({})).toEqual([]);
		expect(readSchemaNames({ schema: null })).toEqual([]);
		expect(readSchemaNames({ schema: [{ required: true }] })).toEqual([]);
	});
});

describe("compareBySegment", () => {
	it("orders by schema segment, then longest first", () => {
		const sequences = [
			sequence(50, 1, "S"),
			sequence(100, 2, null),
			sequence(400, 3, "L"),
			sequence(900, 4, null),
		];

		expect(
			[...sequences]
				.sort((a, b) => compareBySegment(a, b, ["L", "S"]))
				.map((entry) => entry.segment ?? entry.length),
		).toEqual(["L", "S", 900, 100]);
	});

	it("sorts a sequence naming an undeclared segment with the unassigned", () => {
		const sequences = [sequence(10, 1, "Absent"), sequence(400, 2, "L")];

		expect(
			[...sequences]
				.sort((a, b) => compareBySegment(a, b, ["L"]))
				.map((entry) => entry.segment),
		).toEqual(["L", "Absent"]);
	});
});

describe("groupSequencesIntoSegments", () => {
	describe("with no schema", () => {
		it("makes one segment when every isolate carries a single sequence", () => {
			// The lengths diverge by a factor of five, which is what a reference
			// holding a partial sequence alongside a complete one looks like. One
			// sequence per isolate means one segment regardless.
			const groups = groupSequencesIntoSegments(
				[[sequence(10000, 1)], [sequence(2000, 2)]],
				[],
			);

			expect(groups).toHaveLength(1);
			expect(markers(groups[0])).toEqual([[1], [2]]);
		});

		it("makes as many segments as the largest isolate carries sequences", () => {
			const groups = groupSequencesIntoSegments(
				[
					[sequence(100, 1), sequence(50, 2)],
					[sequence(98, 3), sequence(48, 4)],
				],
				[],
			);

			expect(groups).toHaveLength(2);
			expect(markers(groups[0])).toEqual([[1], [3]]);
			expect(markers(groups[1])).toEqual([[2], [4]]);
		});

		it("leaves a missing sequence's segment unfilled rather than shifting the rest", () => {
			// The second isolate has no middle sequence. Pairing by rank would merge
			// its shortest against the first isolate's middle segment; binning by
			// length puts it where it belongs and leaves the middle to one isolate.
			const groups = groupSequencesIntoSegments(
				[
					[sequence(1234, 1), sequence(778, 2), sequence(123, 3)],
					[sequence(1230, 4), sequence(125, 5)],
				],
				[],
			);

			expect(groups).toHaveLength(3);
			expect(markers(groups[0])).toEqual([[1], [4]]);
			expect(markers(groups[1])).toEqual([[2]]);
			expect(markers(groups[2])).toEqual([[3], [5]]);

			// The unfilled segment names the isolate that did carry it, so the other
			// can be told apart from an isolate that simply came later in the list.
			expect(groups[1]?.isolates.map((entry) => entry.index)).toEqual([0]);
			expect(groups[2]?.isolates.map((entry) => entry.index)).toEqual([0, 1]);
		});

		it("concatenates an isolate's sequences that fall in one segment", () => {
			// Two sequences too close in length to separate, so the isolate fills one
			// bin twice and leaves the other to its neighbour.
			const groups = groupSequencesIntoSegments(
				[
					[sequence(100, 1), sequence(98, 2)],
					[sequence(100, 3), sequence(50, 4)],
				],
				[],
			);

			expect(groups).toHaveLength(2);
			expect(markers(groups[0])).toEqual([[1, 2], [3]]);
			expect(depthsOf(groups[0])[0]).toHaveLength(198);
			expect(markers(groups[1])).toEqual([[4]]);
		});
	});

	describe("with a schema", () => {
		it("groups by segment name, in schema order", () => {
			const groups = groupSequencesIntoSegments(
				[
					[sequence(300, 1, "L"), sequence(200, 2, "M"), sequence(100, 3, "S")],
					[sequence(290, 4, "L"), sequence(95, 5, "S")],
				],
				["L", "M", "S"],
			);

			expect(groups.map((group) => group.name)).toEqual(["L", "M", "S"]);

			// The isolate with no M sequence contributes to L and S and nothing else,
			// so M is read across the one isolate that carried it.
			expect(markers(groups[1])).toEqual([[2]]);
			expect(markers(groups[2])).toEqual([[3], [5]]);
		});

		it("keeps a declared segment no isolate was hit against, in its place", () => {
			// Nothing mapped to M. It is a partial detection rather than an OTU whose
			// reference never had the segment, so it keeps its column between L and S.
			const groups = groupSequencesIntoSegments(
				[[sequence(300, 1, "L"), sequence(100, 2, "S")]],
				["L", "M", "S"],
				new Map([
					["L", 300],
					["M", 200],
					["S", 100],
				]),
			);

			expect(groups.map((group) => group.name)).toEqual(["L", "M", "S"]);
			expect(groups[1]?.isolates).toEqual([]);

			// Its width has to come from the schema, since it has no curve.
			expect(groups[1]?.declaredLength).toBe(200);
		});

		it("drops a declared segment the otu holds no sequence for at all", () => {
			// A schema can declare a segment no isolate carries. There is nothing to
			// draw and no width to draw it at, so it is not a column.
			const groups = groupSequencesIntoSegments(
				[[sequence(300, 1, "L")]],
				["L", "M"],
				new Map([["L", 300]]),
			);

			expect(groups.map((group) => group.name)).toEqual(["L"]);
		});

		it("keeps a segment named but not declared, after the declared ones", () => {
			// A patched OTU can name a segment the schema at that version does not
			// declare. The name still matches across isolates; it only loses its place
			// in the order.
			const groups = groupSequencesIntoSegments(
				[
					[sequence(300, 1, "L"), sequence(50, 2, "Absent")],
					[sequence(290, 3, "L"), sequence(48, 4, "Absent")],
				],
				["L"],
			);

			expect(groups.map((group) => group.name)).toEqual(["L", "Absent"]);
			expect(markers(groups[1])).toEqual([[2], [4]]);
		});

		it("bins the unassigned sequences behind the declared segments", () => {
			const groups = groupSequencesIntoSegments(
				[
					[sequence(300, 1, "L"), sequence(40, 2)],
					[sequence(290, 3, "L"), sequence(38, 4)],
				],
				["L"],
			);

			expect(groups.map((group) => group.name)).toEqual(["L", null]);
			expect(markers(groups[1])).toEqual([[2], [4]]);
		});
	});

	it("keys named and length-inferred segments into separate spaces", () => {
		// An OTU declaring a segment named `0` must not collide with the first bin.
		const groups = groupSequencesIntoSegments(
			[[sequence(300, 1, "0"), sequence(40, 2)]],
			["0"],
		);

		expect(groups.map((group) => group.key)).toEqual(["seg:0", "len:0"]);
	});

	it("makes no segments for an otu with no hit sequences", () => {
		expect(groupSequencesIntoSegments([], ["L"])).toEqual([]);
		expect(groupSequencesIntoSegments([[]], [])).toEqual([]);
	});
});
