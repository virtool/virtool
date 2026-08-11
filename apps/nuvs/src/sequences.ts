/**
 * Reading sequence files off the work path, streamed.
 *
 * Ports `read_fastq_headers` and `filter_reads_by_headers` from `utils.py`,
 * which are Biopython's `SeqIO.parse` and `SeqIO.write`. There is no Biopython
 * equivalent here and none is wanted: `parseFastq` and `parseFastaLines` from
 * `@virtool/bio` are async generators over lines, so everything below reads one
 * record at a time.
 *
 * **Nothing here may buffer a file.** A trimmed reads file runs to many
 * gigabytes and an assembly is not something this side sized, so no path is safe
 * to read whole. The one thing that legitimately accumulates is the id set —
 * Python holds the same set, and there is no filtering by membership without it.
 */

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { parseFastq } from "@virtool/bio";

/**
 * The id of a read, from its header line.
 *
 * Biopython's `record.id` is the header up to the first whitespace, with the
 * leading `@` removed — the rest of the line is the description, and the two
 * mates of a pair differ there rather than in the id. Splitting anywhere else
 * would make every read look unpaired.
 */
function readId(header: string): string {
	return header.slice(1).split(/\s+/, 1)[0] ?? "";
}

/**
 * Lines of a text file, gzipped or not.
 *
 * The read stream's errors are forwarded into the gunzip stream by hand. `pipe`
 * does not do it, so a file that vanishes mid-read would otherwise leave the
 * reader waiting on a stream nothing will ever end.
 */
export function readLines(
	path: string,
	{ gzipped = false }: { gzipped?: boolean } = {},
): AsyncIterable<string> {
	const source = createReadStream(path);

	let input: Readable = source;

	if (gzipped) {
		const gunzip = createGunzip();

		source.on("error", (err) => gunzip.destroy(err));
		input = source.pipe(gunzip);
	}

	return createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
}

/** Every read id in an uncompressed FASTQ file. */
export async function readFastqIds(path: string): Promise<Set<string>> {
	const ids = new Set<string>();

	for await (const record of parseFastq(readLines(path))) {
		ids.add(readId(record.header));
	}

	return ids;
}

/** What {@link filterFastqByIds} needs. */
export type FilterFastqOptions = {
	/** Keep a record only if its id is in here. */
	ids: ReadonlySet<string>;
	source: string;
	/** Whether `source` is gzipped. The target never is. */
	sourceGzipped: boolean;
	target: string;
};

/**
 * Copy the records of `source` whose id is in `ids` to `target`.
 *
 * The separator line is written as a bare `+`, which is what Biopython writes
 * however the input spelled it.
 */
export async function filterFastqByIds({
	ids,
	source,
	sourceGzipped,
	target,
}: FilterFastqOptions): Promise<void> {
	await mkdir(dirname(target), { recursive: true });

	await pipeline(
		(async function* () {
			for await (const record of parseFastq(
				readLines(source, { gzipped: sourceGzipped }),
			)) {
				if (ids.has(readId(record.header))) {
					yield `${record.header}\n${record.sequence}\n+\n${record.quality}\n`;
				}
			}
		})(),
		createWriteStream(target),
	);
}
