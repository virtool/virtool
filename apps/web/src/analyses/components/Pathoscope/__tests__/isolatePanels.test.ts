import type {
	PathoscopeSegmentCoverage,
	PathoscopeSequence,
} from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { buildIsolatePanels } from "../isolatePanels";

function segment(
	key: string,
	length: number,
	name: string | null,
	detected = true,
): PathoscopeSegmentCoverage {
	return { align: [], detected, key, length, name };
}

function sequence(
	segmentKey: string,
	accession: string,
	length: number,
): PathoscopeSequence {
	return {
		accession,
		align: [
			[0, 5],
			[length, 5],
		],
		best: 10,
		coverage: 1,
		definition: `${accession} definition`,
		id: accession,
		length,
		pi: 0.5,
		reads: 20,
		segmentKey,
	};
}

const segments = [
	segment("seg:L", 8900, "L"),
	segment("seg:M", 4800, "M"),
	segment("seg:S", 2900, "S"),
];

function captions(
	segmentList: PathoscopeSegmentCoverage[],
	sequences: PathoscopeSequence[],
	absentSegmentKeys: string[] = [],
) {
	return buildIsolatePanels(segmentList, sequences, absentSegmentKeys).map(
		(panel) => [panel.label, panel.lengthLabel],
	);
}

describe("buildIsolatePanels()", () => {
	it.each<
		[
			string,
			PathoscopeSegmentCoverage[],
			PathoscopeSequence[],
			string[],
			string[][],
		]
	>([
		[
			// The segment name, not the accession. The length is the sequence's own,
			// not the segment's, which is as long as the longest sequence any isolate
			// filled it with.
			"label a named segment with its name and the sequence's own length",
			segments,
			[
				sequence("seg:L", "NC_L", 8700),
				sequence("seg:M", "NC_M", 4800),
				sequence("seg:S", "NC_S", 2900),
			],
			[],
			[
				["L", "8,700 nt"],
				["M", "4,800 nt"],
				["S", "2,900 nt"],
			],
		],
		[
			// The panel stays in place, or L and S would read as though they were the
			// isolate's first two segments. It has no sequence, so it has no length.
			"hold a lengthless panel for a segment the isolate does not carry",
			segments,
			[sequence("seg:L", "NC_L", 8900), sequence("seg:S", "NC_S", 2900)],
			["seg:M"],
			[
				["L", "8,900 nt"],
				["M · not in this isolate", ""],
				["S", "2,900 nt"],
			],
		],
		[
			"fall back to the accession when the segment has no schema name",
			[segment("len:8900", 8900, null)],
			[sequence("len:8900", "NC_X", 8900)],
			[],
			[["NC_X", "8,900 nt"]],
		],
		[
			// M took no reads. The server says the isolate carries it by leaving it off
			// `absentSegmentKeys`.
			"not claim the isolate lacks a segment it carries but nothing mapped to",
			segments,
			[sequence("seg:L", "NC_L", 8900)],
			["seg:S"],
			[
				["L", "8,900 nt"],
				["M · no reads", ""],
				["S · not in this isolate", ""],
			],
		],
		[
			// The reference may describe a segment that no hit was recorded against for
			// every isolate, so `detected` must not decide this.
			"not claim the isolate lacks a segment nothing mapped to",
			[segment("seg:L", 8900, "L"), segment("seg:M", 4800, "M", false)],
			[sequence("seg:L", "NC_L", 8900)],
			[],
			[
				["L", "8,900 nt"],
				["M · no reads", ""],
			],
		],
		[
			// An unhit sequence has no length bin to fall in, so the server can place
			// no isolate in or out of one.
			"not claim the isolate lacks a length-inferred segment",
			[segment("len:0", 8900, null), segment("len:1", 2900, null)],
			[sequence("len:0", "NC_X", 8900)],
			[],
			[
				["NC_X", "8,900 nt"],
				["Segment · no reads", ""],
			],
		],
	])("should %s", (_, segmentList, sequences, absent, expected) => {
		expect(captions(segmentList, sequences, absent)).toEqual(expected);
	});

	it("should pair each panel with its sequence, laid out against the segment", () => {
		const l = sequence("seg:L", "NC_L", 8700);

		const [first, second] = buildIsolatePanels(segments, [l], []);

		expect(first).toMatchObject({
			align: l.align,
			key: "seg:L",
			length: 8900,
			sequence: l,
		});
		expect(second).toMatchObject({
			align: null,
			key: "seg:M",
			sequence: undefined,
		});
	});
});
