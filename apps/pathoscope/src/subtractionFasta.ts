/**
 * Preparing a subtraction genome for `bowtie2-build`.
 *
 * A host genome is uploaded as its user had it, and nothing stops two of its
 * records sharing a name up to the first space — `>Prunus persica chr1` and
 * `>Prunus persica chr2` are both `Prunus` once bowtie2 truncates them. bowtie2
 * then writes a SAM header with duplicate `@SQ` names, and htslib refuses it:
 * `samtools view` fails on the header, and with `--no-PG` on the first record.
 *
 * Nothing reads a subtraction alignment's reference name — elimination compares
 * read names and alignment scores only — so every record is renamed to its
 * ordinal rather than repaired where it collides.
 */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const HEADER_START = 0x3e;
const NEWLINE = 0x0a;

/**
 * Rename every FASTA record to its one-based ordinal.
 *
 * Works on bytes and never splits lines: a chromosome written on one line is
 * hundreds of megabytes, and only header lines are ever replaced.
 */
export async function* renameSequences(
	source: AsyncIterable<Buffer>,
): AsyncGenerator<Buffer> {
	let atLineStart = true;
	let inHeader = false;
	let ordinal = 0;

	for await (const chunk of source) {
		const parts: Buffer[] = [];

		// The first byte neither emitted nor dropped yet.
		let start = 0;
		let position = 0;

		while (position < chunk.length) {
			if (inHeader) {
				const end = chunk.indexOf(NEWLINE, position);

				if (end === -1) {
					start = chunk.length;
					break;
				}

				inHeader = false;
				start = end;
				position = end;
			}

			if (atLineStart) {
				atLineStart = false;

				if (chunk[position] === HEADER_START) {
					parts.push(chunk.subarray(start, position));

					ordinal += 1;
					parts.push(Buffer.from(`>${ordinal}`));

					inHeader = true;
					position += 1;
					start = position;

					continue;
				}
			}

			const end = chunk.indexOf(NEWLINE, position);

			if (end === -1) {
				break;
			}

			atLineStart = true;
			position = end + 1;
		}

		if (start < chunk.length) {
			parts.push(chunk.subarray(start));
		}

		const output = Buffer.concat(parts);

		if (output.length > 0) {
			yield output;
		}
	}
}

/**
 * Stream a gzipped genome into a decompressed FASTA whose records are named by
 * {@link renameSequences}.
 */
export async function writeSubtractionFasta(
	source: AsyncIterable<Uint8Array>,
	path: string,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });

	await pipeline(
		source,
		createGunzip(),
		renameSequences,
		createWriteStream(path),
	);
}
