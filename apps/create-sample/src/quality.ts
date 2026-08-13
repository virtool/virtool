/**
 * Driving `quality-core` and reading what it wrote.
 *
 * The statistics themselves are the crate's — `packages/quality-core`, a port
 * of FastQC 0.11.9's four relevant modules, tested against real FastQC output.
 * What lives here is the part that touches a tool and a filesystem: the
 * command line, and the results file.
 *
 * **One invocation per read.** The crate profiles one file and pairing stays
 * on this side, where `compositeQuality` is the port of Python's averaging and
 * is tested against it. Handing the crate both mates would move that into a
 * second implementation for no gain.
 *
 * Nothing here searches a directory. FastQC wrote a report directory whose
 * name it derived from the input by a suffix-stripping rule that is not a
 * contract, which is why the old module ran one invocation per read into an
 * output directory of its own and asserted it found exactly one report. The
 * crate writes the path it is given.
 */

import { readFile } from "node:fs/promises";
import { compositeQuality } from "@virtool/bio";
import type { Quality } from "@virtool/contracts";

const QUALITY_CORE_TOOL = "quality-core";

/**
 * Profile one read file, writing the blob to `outputPath`.
 *
 * The crate reads gzip natively, so this runs against the upload as it lies
 * and the run never writes a decompressed FASTQ.
 */
export function buildQualityCommand(
	readPath: string,
	outputPath: string,
): string[] {
	return [QUALITY_CORE_TOOL, "--input", readPath, "--output", outputPath];
}

/**
 * Read back the blob one invocation wrote.
 *
 * Read whole rather than streamed, unlike everything else this workflow moves:
 * the blob is a few kilobytes for a read file of any size — one row per cycle,
 * and a cycle count is a read length.
 *
 * Cast rather than parsed, matching `pathoscopeCore.ts`. The shape is checked
 * where it crosses the wire, by `FinalizeSampleRequest` in
 * `@virtool/contracts`; a second schema here would be free to disagree with
 * that one.
 */
export async function readQuality(outputPath: string): Promise<Quality> {
	return JSON.parse(await readFile(outputPath, "utf8")) as Quality;
}

/**
 * Reduce one or two profiled reads to the single `Quality` a sample stores.
 *
 * A paired sample's two blobs are averaged into one, which is the shape
 * `legacy_samples.quality` holds and every chart in the SPA reads.
 *
 * The averaging is order-insensitive in every field but `encoding`, which is
 * taken from the first — and both files of a pair always carry the same one.
 * The order is the uploads', because a fixture that has to reproduce a
 * byte-exact blob should not depend on anything else.
 *
 * @throws {Error} when handed neither one blob nor two, which the context
 *   builder has already ruled out.
 */
export function reduceQuality(reports: readonly Quality[]): Quality {
	const [first, second, ...rest] = reports;

	if (first === undefined || rest.length > 0) {
		throw new Error(`Expected 1 or 2 quality reports, found ${reports.length}`);
	}

	return second === undefined ? first : compositeQuality(first, second);
}
