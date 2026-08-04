import { describe, expect, it } from "vitest";
import { parseHmmerTblout } from "./hmmer";

/**
 * An `hmmscan --tblout` table as HMMER writes it, including the three comment
 * lines it opens with and the column alignment it pads to.
 *
 * Columns are: target(0) accession(1) query(2) accession(3), then the full
 * sequence E-value(4) score(5) bias(6), then the best domain E-value(7)
 * score(8) bias(9), then the domain number estimates.
 */
const TBLOUT = `#                                                               --- full sequence ---- --- best 1 domain ---- --- domain number estimation ----
# target name        accession  query name           accession    E-value  score  bias   E-value  score  bias   exp reg clu  ov env dom rep inc description of target
#------------------- ---------- -------------------- ---------- --------- ------ ----- --------- ------ -----   --- --- --- --- --- --- --- --- ---------------------
vFam_806             -          sequence_0.0         -            1.2e-45  154.3   0.4   1.5e-45  154.0   0.3   1.0   1   0   0   0   1   1   1 -
vFam_1220            -          sequence_0.0         -            3.4e-20   71.2   1.1   5.6e-20   70.5   0.8   1.1   1   0   0   0   1   1   1 -
vFam_97              -          sequence_0.1         -            8.9e-11   40.6   0.0   9.9e-11   40.4   0.0   1.0   1   0   0   0   1   1   1 -
notVFam_1            -          sequence_0.2         -            1.0e-99  999.9   9.9   1.0e-99  999.9   9.9   1.0   1   0   0   0   1   1   1 -
vFam_3               -          sequence_12.4        -            2.2e-07   28.1   0.2   4.4e-07   27.2   0.1   1.0   1   0   0   0   1   1   1 -
#
# Program:         hmmscan
# Query file:      orfs.fa
//`;

function parse(text: string) {
	return parseHmmerTblout(text.split("\n"));
}

describe("parseHmmerTblout", () => {
	it("keeps only vFam rows, skipping comments and other targets", () => {
		const hits = parse(TBLOUT);

		expect(hits).toHaveLength(4);
		expect(hits.map((hit) => hit.cluster)).toEqual([806, 1220, 97, 3]);
	});

	it("parses the contig and ORF indices from the query name", () => {
		const hits = parse(TBLOUT);

		expect(hits.map((hit) => [hit.sequenceIndex, hit.orfIndex])).toEqual([
			[0, 0],
			[0, 0],
			[0, 1],
			[12, 4],
		]);
	});

	it("keeps multiple hits on one ORF in file order", () => {
		const hits = parse(TBLOUT).filter(
			(hit) => hit.sequenceIndex === 0 && hit.orfIndex === 0,
		);

		expect(hits.map((hit) => hit.cluster)).toEqual([806, 1220]);
	});

	it("parses the full sequence scores", () => {
		const [hit] = parse(TBLOUT);

		expect(hit.full_e).toBe(1.2e-45);
		expect(hit.full_score).toBe(154.3);
		expect(hit.full_bias).toBe(0.4);
		expect(hit.best_e).toBe(1.5e-45);
	});

	/**
	 * `best_bias` reads column 8 and `best_score` reads column 9, which hmmscan
	 * documents as the best-domain score and bias respectively — so the two are
	 * swapped. This is deliberate bug-compatibility with the Python workflow,
	 * whose output is already stored under these names; see the note in
	 * `hmmer.ts`.
	 */
	it("reproduces Python's swapped best_bias and best_score columns", () => {
		const [hit] = parse(TBLOUT);

		// Column 8 is the best-domain score, 154.0, but Python calls it bias.
		expect(hit.best_bias).toBe(154.0);

		// Column 9 is the best-domain bias, 0.3, but Python calls it score.
		expect(hit.best_score).toBe(0.3);
	});

	/**
	 * Python raises IndexError here. Parsing on would put NaN into the hit and
	 * carry it into the stored analysis document.
	 */
	it("throws on a truncated vFam row rather than emitting NaN", () => {
		expect(() => parse("vFam_5 - sequence_1.2 - 1e-10 10.0 0.1")).toThrow(
			/expected at least 10 fields/,
		);
	});

	it("returns an empty array for a table with no vFam rows", () => {
		expect(parse("# comment only\n//")).toEqual([]);
	});

	it("accepts any iterable of lines", () => {
		function* lines() {
			yield "# header";
			yield "vFam_5 - sequence_1.2 - 1e-10 10.0 0.1 2e-10 9.0 0.2 1.0";
		}

		const hits = parseHmmerTblout(lines());

		expect(hits).toHaveLength(1);
		expect(hits[0]).toEqual({
			best_bias: 9,
			best_e: 2e-10,
			best_score: 0.2,
			cluster: 5,
			full_bias: 0.1,
			full_e: 1e-10,
			full_score: 10,
			orfIndex: 2,
			sequenceIndex: 1,
		});
	});
});
