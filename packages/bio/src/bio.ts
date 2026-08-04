const COMPLEMENT: Record<string, string> = {
	A: "T",
	T: "A",
	G: "C",
	C: "G",
	N: "N",
};

const TRANSLATION: Record<string, string> = {
	TTT: "F",
	TTC: "F",
	TTA: "L",
	TTG: "L",
	CTT: "L",
	CTC: "L",
	CTA: "L",
	CTG: "L",
	CTN: "L",
	ATT: "I",
	ATC: "I",
	ATA: "I",
	ATG: "M",
	GTT: "V",
	GTC: "V",
	GTA: "V",
	GTG: "V",
	GTN: "V",
	TCT: "S",
	TCC: "S",
	TCA: "S",
	TCG: "S",
	TCN: "S",
	AGT: "S",
	AGC: "S",
	CCT: "P",
	CCC: "P",
	CCA: "P",
	CCG: "P",
	CCN: "P",
	ACT: "T",
	ACC: "T",
	ACA: "T",
	ACG: "T",
	ACN: "T",
	GCT: "A",
	GCC: "A",
	GCA: "A",
	GCG: "A",
	GCN: "A",
	TAT: "Y",
	TAC: "Y",
	TAA: "*",
	TAG: "*",
	TGA: "*",
	CAT: "H",
	CAC: "H",
	CAA: "Q",
	CAG: "Q",
	AAT: "N",
	AAC: "N",
	AAA: "K",
	AAG: "K",
	GAT: "D",
	GAC: "D",
	GAA: "E",
	GAG: "E",
	TGT: "C",
	TGC: "C",
	TGG: "W",
	CGT: "R",
	CGC: "R",
	CGA: "R",
	CGG: "R",
	CGN: "R",
	AGA: "R",
	AGG: "R",
	GGT: "G",
	GGC: "G",
	GGA: "G",
	GGG: "G",
	GGN: "G",
};

export function reverseComplement(sequence: string): string {
	const upper = sequence.toUpperCase();
	let out = "";
	for (let i = upper.length - 1; i >= 0; i--) {
		const base = upper.charAt(i);
		const comp = COMPLEMENT[base];
		if (comp === undefined) {
			throw new Error(`Invalid nucleotide: ${base}`);
		}
		out += comp;
	}
	return out;
}

export function translate(sequence: string): string {
	const upper = sequence.toUpperCase();
	const codonCount = Math.floor(upper.length / 3);
	let out = "";
	for (let i = 0; i < codonCount; i++) {
		const codon = upper.slice(i * 3, i * 3 + 3);
		out += TRANSLATION[codon] ?? "X";
	}
	return out;
}

export type Orf = {
	pro: string;
	nuc: string;
	frame: number;
	strand: 1 | -1;
	pos: [number, number];
};

/**
 * Slice with Python's semantics: a negative bound counts back from the end and
 * an inverted range yields the empty string.
 *
 * `findOrfs` needs this because Python's ORF coordinates can go negative — see
 * the note there.
 */
function pythonSlice(text: string, start: number, end: number): string {
	const length = text.length;
	const from =
		start < 0 ? Math.max(length + start, 0) : Math.min(start, length);
	const to = end < 0 ? Math.max(length + end, 0) : Math.min(end, length);

	return to > from ? text.slice(from, to) : "";
}

/**
 * Find every ORF of at least 100 residues in a nucleotide sequence.
 *
 * This is a transliteration of Python's `find_orfs`, quirks included, because
 * `pos` is stored positionally in the NuVs analysis `results` blob and rendered
 * by the UI. Two of those quirks are visible in the output:
 *
 * - The forward-strand `end` adds the stop codon's three bases unconditionally
 *   and then clamps to the sequence length, so an ORF that runs off the end
 *   reports `end` at the sequence length rather than at the last full codon.
 * - The reverse-strand `start` subtracts three unconditionally and is never
 *   clamped, so an ORF with no stop codon reports a **negative** start — `-3`,
 *   `-2` or `-1`, depending on the trailing remainder.
 *
 * `nuc` inherits both, and is sliced with Python's negative-index semantics.
 * The NuVs workflow drops `nuc` before the ORFs reach the stored document, so
 * only `pos` is observable downstream, but it is reproduced here so the whole
 * record matches Python.
 */
export function findOrfs(sequence: string): Orf[] {
	const orfs: Orf[] = [];
	const length = sequence.length;

	if (length <= 300) return orfs;

	const strands: Array<[1 | -1, string]> = [
		[1, sequence],
		[-1, reverseComplement(sequence)],
	];

	for (const [strand, nuc] of strands) {
		for (let frame = 0; frame < 3; frame++) {
			const translation = translate(nuc.slice(frame));
			const translationLength = translation.length;
			let aaStart = 0;

			while (aaStart < translationLength) {
				const stopIndex = translation.indexOf("*", aaStart);
				const aaEnd = stopIndex === -1 ? translationLength : stopIndex;

				if (aaEnd - aaStart >= 100) {
					let start: number;
					let end: number;

					if (strand === 1) {
						start = frame + aaStart * 3;
						end = Math.min(length, frame + aaEnd * 3 + 3);
					} else {
						start = length - frame - aaEnd * 3 - 3;
						end = length - frame - aaStart * 3;
					}

					orfs.push({
						pro: translation.slice(aaStart, aaEnd),
						nuc: pythonSlice(nuc, start, end),
						frame,
						strand,
						pos: [start, end],
					});
				}

				aaStart = aaEnd + 1;
			}
		}
	}

	return orfs;
}

export function parseFasta(content: string): Array<[string, string]> {
	const records: Array<[string, string]> = [];
	let header: string | null = null;
	let seq: string[] = [];

	for (const rawLine of content.split("\n")) {
		const line = rawLine.replace(/\r$/, "");
		if (line === "") continue;

		if (line[0] === ">") {
			if (header !== null) {
				records.push([header, seq.join("")]);
			}
			header = line.slice(1);
			seq = [];
			continue;
		}

		if (header === null) {
			throw new Error(`Illegal FASTA line: ${rawLine}`);
		}

		seq.push(line);
	}

	if (header !== null) {
		records.push([header, seq.join("")]);
	}

	return records;
}

export type FastqRecord = {
	header: string;
	sequence: string;
	quality: string;
};

export async function* parseFastq(
	lines: AsyncIterable<string> | Iterable<string>,
): AsyncGenerator<FastqRecord> {
	let state: "header" | "sequence" | "separator" | "quality" = "header";
	let header = "";
	let sequence = "";

	for await (const rawLine of lines) {
		const line = rawLine.replace(/\r$/, "");

		switch (state) {
			case "header":
				if (line === "") continue;
				if (line[0] !== "@") {
					throw new Error(`Malformed FASTQ: expected header, got "${line}"`);
				}
				header = line;
				state = "sequence";
				break;
			case "sequence":
				sequence = line;
				state = "separator";
				break;
			case "separator":
				if (line[0] !== "+") {
					throw new Error(`Malformed FASTQ: expected separator, got "${line}"`);
				}
				state = "quality";
				break;
			case "quality":
				yield { header, sequence, quality: line };
				state = "header";
				break;
		}
	}

	if (state !== "header") {
		throw new Error("Malformed FASTQ: truncated record");
	}
}
