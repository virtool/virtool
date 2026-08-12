import { describe, expect, it } from "vitest";
import {
	findOrfs,
	parseFasta,
	parseFastaLines,
	parseFastq,
	reverseComplement,
	translate,
} from "./bio";

describe("reverseComplement", () => {
	it("complements and reverses A/T/G/C", () => {
		expect(reverseComplement("ATCG")).toBe("CGAT");
		expect(reverseComplement("AAAA")).toBe("TTTT");
		expect(reverseComplement("GGGG")).toBe("CCCC");
	});

	it("preserves N", () => {
		expect(reverseComplement("ANCG")).toBe("CGNT");
	});

	it("uppercases lowercase input", () => {
		expect(reverseComplement("atcg")).toBe("CGAT");
	});

	it("returns empty for empty input", () => {
		expect(reverseComplement("")).toBe("");
	});

	it("throws on invalid nucleotide", () => {
		expect(() => reverseComplement("ATBG")).toThrow(/Invalid nucleotide: B/);
	});

	it("is its own inverse", () => {
		const seq = "ATCGNATCGGCTAA";
		expect(reverseComplement(reverseComplement(seq))).toBe(seq);
	});
});

describe("translate", () => {
	it("translates a simple ORF", () => {
		expect(translate("ATGAAATAA")).toBe("MK*");
	});

	it("uppercases lowercase input", () => {
		expect(translate("atgaaa")).toBe("MK");
	});

	it("discards trailing partial codons", () => {
		expect(translate("ATGAA")).toBe("M");
		expect(translate("ATGA")).toBe("M");
	});

	it("returns X for unknown codons", () => {
		expect(translate("AAN")).toBe("X");
		expect(translate("ATGAANTAA")).toBe("MX*");
	});

	it("handles ambiguous N codons that are in the table", () => {
		expect(translate("CTN")).toBe("L");
		expect(translate("GGN")).toBe("G");
	});

	it("returns empty for empty input", () => {
		expect(translate("")).toBe("");
	});
});

/**
 * The expected values here are written out rather than captured from a fixture,
 * because they are what Python's `find_orfs` returns and what is already stored
 * in analysis documents. A failure is a finding — never re-baseline one of
 * these to match a change in this implementation.
 */
describe("findOrfs", () => {
	it("returns empty for sequences of 300 bp or less", () => {
		expect(findOrfs("A".repeat(300))).toStrictEqual([]);
		expect(findOrfs("A".repeat(100))).toStrictEqual([]);
		expect(findOrfs("")).toStrictEqual([]);
	});

	it("returns empty when no frame has 100+ residues without a stop", () => {
		// 99 K's + stop on forward frame 0; reverse strand produces 'TTA' + 'TTT'*99 — also <100
		const seq = `${"AAA".repeat(99)}TAA`;
		expect(seq).toHaveLength(300);
		expect(findOrfs(seq)).toStrictEqual([]);
	});

	it("finds ORFs on both strands and frames 0 and 1", () => {
		const seq = "G".repeat(301);
		const orfs = findOrfs(seq);
		// Forward frames 0 and 1 both yield 100 G codons; reverse (all C) yields 100 P codons in frames 0 and 1.
		expect(orfs).toHaveLength(4);

		const forward = orfs.filter((o) => o.strand === 1);
		expect(forward.map((o) => o.frame).toSorted()).toStrictEqual([0, 1]);
		expect(forward.every((o) => o.pro === "G".repeat(100))).toBe(true);

		const reverse = orfs.filter((o) => o.strand === -1);
		expect(reverse.map((o) => o.frame).toSorted()).toStrictEqual([0, 1]);
		expect(reverse.every((o) => o.pro === "P".repeat(100))).toBe(true);
	});

	it("reports correct positions and nucleotide spans on the forward strand", () => {
		const seq = `ATG${"AAA".repeat(99)}TAAGG`;
		expect(seq).toHaveLength(305);

		const forward0 = findOrfs(seq).find((o) => o.strand === 1 && o.frame === 0);
		expect(forward0).toBeDefined();
		if (forward0 === undefined) {
			throw new Error("expected forward ORF");
		}
		expect(forward0.pro).toBe(`M${"K".repeat(99)}`);
		expect(forward0.pos).toStrictEqual([0, 303]);
		expect(forward0.nuc).toBe(`ATG${"AAA".repeat(99)}TAA`);
	});

	/**
	 * `pos` on the reverse strand is a correct pair of *forward* coordinates,
	 * but Python then slices `nuc` out of the reverse-complement using them —
	 * so `nuc` is offset by the stop codon's three bases, holding the stop that
	 * opens the ORF instead of the one that closes it. The protein is taken
	 * from the translation and is unaffected.
	 *
	 * This one is reproduced for completeness only: NuVs pops `nuc` before the
	 * ORFs reach the stored document, so nothing downstream observes it.
	 */
	it("reports forward coordinates but an offset nuc on the reverse strand", () => {
		const reverseOriented = `TAA${"GCT".repeat(100)}TAA`;
		const seq = reverseComplement(reverseOriented);

		const reverse0 = findOrfs(seq).find(
			(o) => o.strand === -1 && o.frame === 0,
		);
		if (reverse0 === undefined) {
			throw new Error("expected reverse ORF");
		}

		expect(reverse0.pro).toBe("A".repeat(100));
		expect(reverse0.pos).toStrictEqual([0, 303]);

		// The strand-oriented span of the ORF, which is what `nuc` ought to hold.
		expect(reverseComplement(seq.slice(0, 303))).toBe(
			`${"GCT".repeat(100)}TAA`,
		);

		// What Python actually stores: the same window taken from the other end.
		expect(reverse0.nuc).toBe(`TAA${"GCT".repeat(100)}`);
		expect(translate(reverse0.nuc.slice(3))).toBe(reverse0.pro);
	});

	/**
	 * Python adds the stop codon's three bases unconditionally and then clamps
	 * to the sequence length, so an ORF with no stop reports `end` at the
	 * sequence length rather than at the end of its last full codon — 301 here,
	 * not 300. Reproduced deliberately; `pos` is stored in the analysis blob.
	 */
	it("clamps the forward-strand end to the sequence length when there is no stop", () => {
		const orfs = findOrfs("G".repeat(301)).filter((o) => o.strand === 1);

		expect(orfs.map((o) => o.pos)).toStrictEqual([
			[0, 301],
			[1, 301],
		]);
	});

	/**
	 * The mirror-image quirk: Python subtracts three unconditionally on the
	 * reverse strand and never clamps, so an ORF with no stop reports a negative
	 * start. `nuc` inherits it — a negative index makes Python's slice wrap to
	 * the end of the string, yielding two bases rather than the ORF's 300. NuVs
	 * drops `nuc` before storage, but `pos` is kept and rendered.
	 */
	it("reports negative reverse-strand starts when there is no stop", () => {
		const orfs = findOrfs("G".repeat(301)).filter((o) => o.strand === -1);

		expect(orfs.map((o) => o.pos)).toStrictEqual([
			[-2, 301],
			[-3, 300],
		]);
		expect(orfs.map((o) => o.pro)).toStrictEqual([
			"P".repeat(100),
			"P".repeat(100),
		]);
		expect(orfs.map((o) => o.nuc)).toStrictEqual(["CC", "CC"]);
	});

	/**
	 * The trailing remainder decides which frame gets which negative start, so
	 * all three are pinned. Every entry runs off the end of the sequence without
	 * a stop, which is the only situation where either coordinate quirk shows.
	 */
	it("assigns positions by trailing remainder when no frame has a stop", () => {
		const positions = (sequence: string) =>
			findOrfs(sequence).map((o) => o.pos);

		// 420 bp: no partial codon in frame 0.
		expect(positions("GCT".repeat(140))).toStrictEqual([
			[0, 420],
			[1, 420],
			[2, 420],
			[-3, 420],
			[-1, 419],
			[-2, 418],
		]);

		// 421 bp: one trailing base.
		expect(positions(`${"GCT".repeat(140)}A`)).toStrictEqual([
			[0, 421],
			[1, 421],
			[2, 421],
			[-2, 418],
			[-3, 420],
			[-1, 419],
		]);

		// 422 bp: two trailing bases.
		expect(positions(`${"GCT".repeat(140)}AA`)).toStrictEqual([
			[0, 422],
			[1, 422],
			[2, 422],
			[-1, 422],
			[-2, 418],
			[-3, 420],
		]);
	});

	it("translates codons containing N to X", () => {
		const orfs = findOrfs("GCTNGA".repeat(100));

		expect(orfs).toHaveLength(6);
		expect(orfs[0].pro.slice(0, 6)).toBe("AXAXAX");
		expect(orfs[0].pos).toStrictEqual([0, 600]);
	});

	/**
	 * `translate` uppercases, but Python slices `nuc` straight out of the input,
	 * so a lowercase sequence keeps its case on the forward strand and gains
	 * uppercase on the reverse — `reverseComplement` uppercases as it goes.
	 */
	it("uppercases the protein but leaves the forward nuc as given", () => {
		const lower = "gct".repeat(140);
		const orfs = findOrfs(lower);

		expect(orfs.map((o) => o.pos)).toStrictEqual(
			findOrfs(lower.toUpperCase()).map((o) => o.pos),
		);
		expect(orfs[0].pro).toBe("A".repeat(140));
		expect(orfs[0].nuc.startsWith("gct")).toBe(true);
		expect(orfs[3].nuc).toBe("AGC");
	});

	it("orders ORFs by strand then frame, in discovery order", () => {
		const orfs = findOrfs(`ATG${"AAA".repeat(99)}TAAGG`);

		expect(orfs.map((o) => [o.strand, o.frame])).toStrictEqual([
			[1, 0],
			[1, 1],
			[1, 2],
			[-1, 0],
			[-1, 1],
			[-1, 2],
		]);
	});

	it("drops a trailing partial codon", () => {
		// 301 and 302 bp both translate to the same 100 codons in frame 0.
		expect(findOrfs("G".repeat(302))[0].pro).toBe("G".repeat(100));
		expect(findOrfs("G".repeat(301))[0].pro).toBe("G".repeat(100));
	});

	it("applies the residue gate at exactly 100", () => {
		const polyAlanine = (residues: number) =>
			findOrfs(`TAA${"GCT".repeat(residues)}TAA`).filter(
				(o) => o.pro === "A".repeat(residues),
			);

		expect(polyAlanine(99)).toHaveLength(0);
		expect(polyAlanine(100)).not.toHaveLength(0);
		expect(polyAlanine(101)).not.toHaveLength(0);
	});

	it("applies the length gate at exactly 300 bp", () => {
		expect(findOrfs("G".repeat(299))).toStrictEqual([]);
		expect(findOrfs("G".repeat(300))).toStrictEqual([]);
		expect(findOrfs("G".repeat(301))).not.toStrictEqual([]);
	});
});

describe("parseFasta", () => {
	it("parses a single record", () => {
		expect(parseFasta(">a\nATCG\n")).toStrictEqual([["a", "ATCG"]]);
	});

	it("parses multiple records", () => {
		const content = ">a\nATCG\n>b\nGGGG\n";
		expect(parseFasta(content)).toStrictEqual([
			["a", "ATCG"],
			["b", "GGGG"],
		]);
	});

	it("joins multi-line sequences", () => {
		const content = ">a\nATCG\nAAAA\nTTTT\n";
		expect(parseFasta(content)).toStrictEqual([["a", "ATCGAAAATTTT"]]);
	});

	it("handles CRLF line endings", () => {
		expect(parseFasta(">a\r\nATCG\r\n")).toStrictEqual([["a", "ATCG"]]);
	});

	it("handles input without a trailing newline", () => {
		expect(parseFasta(">a\nATCG")).toStrictEqual([["a", "ATCG"]]);
	});

	it("returns empty for empty input", () => {
		expect(parseFasta("")).toStrictEqual([]);
	});

	it("throws when a sequence line precedes any header", () => {
		expect(() => parseFasta("ATCG\n>a\nGGGG\n")).toThrow(/Illegal FASTA line/);
	});

	it("preserves the rest of the header line including spaces", () => {
		expect(parseFasta(">id description here\nATCG\n")).toStrictEqual([
			["id description here", "ATCG"],
		]);
	});
});

describe("parseFastaLines", () => {
	async function collect(content: string): Promise<Array<[string, string]>> {
		const records: Array<[string, string]> = [];

		for await (const record of parseFastaLines(content.split("\n"))) {
			records.push(record);
		}

		return records;
	}

	// The streaming parser exists so an assembly no caller sized itself is not
	// read into one string. It is only worth having if it agrees with the
	// synchronous one record for record, so every case above is replayed through
	// it rather than restated.
	it.each([
		">a\nATCG\n",
		">a\nATCG\n>b\nGGGG\n",
		">a\nATCG\nAAAA\nTTTT\n",
		">a\r\nATCG\r\n",
		">a\nATCG",
		"",
		"\n\n>a\n\nATCG\n\n",
		">id description here\nATCG\n",
	])("agrees with parseFasta on %j", async (content) => {
		expect(await collect(content)).toStrictEqual(parseFasta(content));
	});

	it("throws when a sequence line precedes any header", async () => {
		await expect(collect("ATCG\n>a\nGGGG\n")).rejects.toThrow(
			/Illegal FASTA line/,
		);
	});

	it("yields each record before the next one is read", async () => {
		const read: string[] = [];

		function* lines() {
			for (const line of [">a", "ATCG", ">b", "GGGG"]) {
				read.push(line);
				yield line;
			}
		}

		const iterator = parseFastaLines(lines());

		// `>b` is what completes `a`, so four lines have been read by the time the
		// first record arrives — and the second record's sequence has not.
		expect((await iterator.next()).value).toStrictEqual(["a", "ATCG"]);
		expect(read).toStrictEqual([">a", "ATCG", ">b"]);
	});
});

describe("parseFastq", () => {
	async function collect(lines: string[]) {
		const out = [];
		for await (const record of parseFastq(lines)) {
			out.push(record);
		}
		return out;
	}

	it("parses a single record", async () => {
		const records = await collect(["@r1", "ATCG", "+", "!!!!"]);
		expect(records).toStrictEqual([
			{ header: "@r1", sequence: "ATCG", quality: "!!!!" },
		]);
	});

	it("parses multiple records", async () => {
		const records = await collect([
			"@r1",
			"ATCG",
			"+",
			"!!!!",
			"@r2",
			"GGGG",
			"+",
			"####",
		]);
		expect(records).toStrictEqual([
			{ header: "@r1", sequence: "ATCG", quality: "!!!!" },
			{ header: "@r2", sequence: "GGGG", quality: "####" },
		]);
	});

	it("strips trailing CR from lines", async () => {
		const records = await collect(["@r1\r", "ATCG\r", "+\r", "!!!!\r"]);
		expect(records).toStrictEqual([
			{ header: "@r1", sequence: "ATCG", quality: "!!!!" },
		]);
	});

	it("works with an async iterable", async () => {
		async function* source() {
			yield "@r1";
			yield "ATCG";
			yield "+";
			yield "!!!!";
		}
		const out = [];
		for await (const record of parseFastq(source())) out.push(record);
		expect(out).toStrictEqual([
			{ header: "@r1", sequence: "ATCG", quality: "!!!!" },
		]);
	});

	it("accepts a separator line with an identifier suffix", async () => {
		const records = await collect(["@r1", "ATCG", "+r1", "!!!!"]);
		expect(records).toStrictEqual([
			{ header: "@r1", sequence: "ATCG", quality: "!!!!" },
		]);
	});

	it("accepts a separator that repeats the header verbatim", async () => {
		const records = await collect(["@r1", "ATCG", "+@r1", "!!!!"]);
		expect(records).toStrictEqual([
			{ header: "@r1", sequence: "ATCG", quality: "!!!!" },
		]);
	});

	it("treats a quality line that begins with + as quality, not a separator", async () => {
		const records = await collect(["@r1", "ATCG", "+", "+!!!"]);
		expect(records).toStrictEqual([
			{ header: "@r1", sequence: "ATCG", quality: "+!!!" },
		]);
	});

	it("throws on a truncated record", async () => {
		await expect(collect(["@r1", "ATCG", "+"])).rejects.toThrow(
			/truncated record/,
		);
	});

	it("throws when the separator line does not start with +", async () => {
		await expect(collect(["@r1", "ATCG", "NOPE", "!!!!"])).rejects.toThrow(
			/expected separator/,
		);
	});
});
