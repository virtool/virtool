/**
 * Driving `fastqc` and locating what it wrote.
 *
 * The parsing itself is `@virtool/bio`'s — `parseFastqcData` and
 * `compositeQuality` are the port of Python's `virtool/quality/fastqc.py` and
 * are tested there. What lives here is the part that touches a tool and a
 * filesystem: the command line, and finding the one `fastqc_data.txt` an
 * invocation produced.
 *
 * **One invocation per read, each into its own output directory.** Python runs
 * a single `fastqc` over both files into the work path and then scans that
 * directory for anything holding a `fastqc_data.txt`, which pairs a report with
 * a read by whatever order the filesystem hands the entries back. Mapping a
 * report to its read the other way — deriving the directory name from the input
 * — means reimplementing FastQC's suffix-stripping rule, which is not a
 * contract. A directory per read makes the pairing structural: exactly one
 * report is in there, so there is nothing to match.
 *
 * The two runs cost no more than the one. FastQC's `-t` sets how many files it
 * processes at once, Python passes it no `-t`, and so both forms work through
 * the reads one at a time.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { compositeQuality, parseFastqcData } from "@virtool/bio";
import type { Quality } from "@virtool/contracts";

/** The file in a FastQC report directory that carries the numbers. */
const DATA_FILE = "fastqc_data.txt";

/**
 * The command Python runs, argument for argument, narrowed to one input.
 *
 * `-f fastq` states the format rather than letting FastQC sniff it, and
 * `--extract` is what writes the report directory this module then reads —
 * without it the run leaves only a zip.
 */
export function buildFastqcCommand(
	readPath: string,
	outputPath: string,
): string[] {
	return ["fastqc", "-f", "fastq", "-o", outputPath, "--extract", readPath];
}

/**
 * The `fastqc_data.txt` one invocation produced.
 *
 * `--extract` leaves a `{basename}_fastqc/` directory beside the zip and the
 * html. Only directories are considered, so the two files alongside are skipped
 * without naming them — the same test Python makes.
 *
 * @throws {Error} when the directory holds no report, or more than one. More
 *   than one means the output directory was shared, which is the ambiguity this
 *   layout exists to prevent.
 */
export async function findFastqcDataFile(outputPath: string): Promise<string> {
	const entries = await readdir(outputPath, { withFileTypes: true });

	const found = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(outputPath, entry.name, DATA_FILE));

	const [first, ...rest] = found;

	if (first === undefined) {
		throw new Error(`FastQC wrote no report directory to ${outputPath}`);
	}

	if (rest.length > 0) {
		throw new Error(
			`FastQC wrote ${found.length} report directories to ${outputPath}; expected one`,
		);
	}

	return first;
}

/**
 * Reduce one or two parsed reports to the single `Quality` a sample stores.
 *
 * A paired sample's two reports are averaged into one blob, which is the shape
 * `legacy_samples.quality` holds and every chart in the SPA reads.
 *
 * The averaging is order-insensitive in every field but `encoding`, which is
 * taken from the first — and both files of a pair always carry the same one.
 * The order is still the uploads' rather than the filesystem's, because a
 * fixture that has to reproduce a byte-exact blob should not depend on which.
 *
 * @throws {Error} when handed neither one report nor two, which the context
 *   builder has already ruled out.
 */
export function reduceQuality(reports: readonly Quality[]): Quality {
	const [first, second, ...rest] = reports;

	if (first === undefined || rest.length > 0) {
		throw new Error(`Expected 1 or 2 FastQC reports, found ${reports.length}`);
	}

	return second === undefined ? first : compositeQuality(first, second);
}

/**
 * Locate, read and parse the report one invocation left in `outputPath`.
 *
 * `readFile` rather than a stream, unlike everything else this workflow moves:
 * `fastqc_data.txt` is tens of kilobytes of text for a read file of any size,
 * and the parser takes the whole document because it is organised in sections.
 */
export async function readFastqcReport(outputPath: string): Promise<Quality> {
	return parseFastqcData(
		await readFile(await findFastqcDataFile(outputPath), "utf8"),
	);
}
