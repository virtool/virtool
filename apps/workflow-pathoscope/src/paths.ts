/**
 * Every path this workflow reads or writes under its work path.
 *
 * One factory rather than a function per path — Python had a fixture each, which
 * transliterates into seventeen exports and a `workPath` argument at every call
 * site. A step resolves them once (`const paths = workPaths(context.workPath)`)
 * and reads fields from there.
 *
 * The layout is Python's `fixtures.py` verbatim, and that is a **contract, not a
 * convention**: a mapping index restored from the cache namespace shared with
 * Python unpacks to these directory names.
 */

import { join } from "node:path";
import { INDEX_SQLITE_FILE_NAME } from "@virtool/workflow";

/** Where one subtraction's genome and its bowtie2 index live. */
export type SubtractionPaths = {
	/** The directory archived into the subtraction mapping-index cache */
	dir: string;

	/** The gzipped source genome, handed to `bowtie2-build` without decompressing */
	fasta: string;

	/** The bowtie2 index prefix — the shards sit beside it */
	indexPrefix: string;
};

/** Every path one pathoscope run uses. */
export type PathoscopePaths = {
	/** The reference index artifact, as downloaded from object storage */
	sourceIndex: (indexId: number) => string;

	/** One of the sample's reads files, by the name the row carries */
	read: (name: string) => string;

	/**
	 * The collapsed reference this workflow writes and then reads back.
	 *
	 * Named like the source rather than `index.sqlite`: it is an artifact of the
	 * same format, and the filename is what distinguishes it from an incompatible
	 * future one before it is opened.
	 */
	collapsedReference: string;

	/** The directory archived into the collapsed-reference cache */
	collapsedReferenceDir: string;

	/** The bowtie2 index prefix over the collapsed default isolates */
	referenceIndexPrefix: string;

	subtraction: (subtractionId: number) => SubtractionPaths;

	/** Every sequence of every candidate OTU */
	isolateFasta: string;

	/** The bowtie2 index prefix over {@link isolateFasta} */
	isolateIndexPrefix: string;

	/** Reads that aligned to an isolate, written by `bowtie2 --al` */
	isolateFastq: string;

	/** Alignments against the isolate index */
	isolateBam: string;

	isolatesDir: string;

	/** The FASTQ carried from one subtraction pass to the next */
	currentFastq: string;

	/**
	 * Where one subtraction pass writes its filtered FASTQ.
	 *
	 * A sibling of {@link currentFastq} rather than that path itself: the core
	 * truncates its output before reading a byte of its input, so writing in place
	 * empties the file it is filtering. Renamed over {@link currentFastq} once the
	 * pass succeeds.
	 */
	filteredFastq: string;

	/** One subtraction pass's alignments, deleted at the end of that pass */
	toSubtractionBam: string;

	/** The BAM carried from one subtraction pass to the next */
	workingIsolateBam: string;

	/** The alignments left after every subtraction has been eliminated */
	subtractedBam: string;

	/** Where each subcommand of `pathoscope-core` writes its JSON results */
	coreResults: (name: string) => string;

	/** Where cache archives are staged, on the volume the pod is sized for */
	cacheStaging: string;

	/** The run's work path, for the two places that need it whole */
	root: string;
};

export function workPaths(workPath: string): PathoscopePaths {
	const isolatesDir = join(workPath, "isolates");

	return {
		root: workPath,

		sourceIndex: (indexId) =>
			join(workPath, "indexes", String(indexId), INDEX_SQLITE_FILE_NAME),

		read: (name) => join(workPath, "reads", name),

		collapsedReference: join(
			workPath,
			"collapsed_reference",
			INDEX_SQLITE_FILE_NAME,
		),
		collapsedReferenceDir: join(workPath, "collapsed_reference"),

		referenceIndexPrefix: join(workPath, "reference_index", "reference"),

		subtraction: (subtractionId) => {
			const dir = join(workPath, "subtraction_indexes", String(subtractionId));

			return {
				dir,
				// Downloaded under `subtractions/`, built under
				// `subtraction_indexes/` — the index directory is what the cache
				// archives, and mixing the genome into it would cache the genome too.
				fasta: join(
					workPath,
					"subtractions",
					String(subtractionId),
					"subtraction.fa.gz",
				),
				indexPrefix: join(dir, "subtraction"),
			};
		},

		isolatesDir,
		isolateFasta: join(isolatesDir, "isolate_index.fa"),
		isolateIndexPrefix: join(isolatesDir, "isolates"),
		isolateFastq: join(isolatesDir, "isolate_mapped.fq"),
		isolateBam: join(isolatesDir, "to_isolates.bam"),

		currentFastq: join(workPath, "current_fastq.fq"),
		filteredFastq: join(workPath, "filtered_fastq.fq"),
		toSubtractionBam: join(workPath, "to_subtraction.bam"),
		workingIsolateBam: join(workPath, "working_isolate.bam"),
		subtractedBam: join(workPath, "subtracted.bam"),

		coreResults: (name) => join(workPath, `${name}.json`),
		cacheStaging: join(workPath, "caches"),
	};
}
