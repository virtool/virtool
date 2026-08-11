/**
 * Every path this workflow reads or writes under its work path.
 *
 * One factory rather than a function per path — Python had a fixture each, which
 * transliterates into a dozen exports and a `workPath` argument at every call
 * site. A step resolves them once (`const paths = workPaths(context.workPath)`)
 * and reads fields from there.
 *
 * The layout is Python's verbatim, and that is a **contract, not a convention**:
 * all three of this workflow's cache namespaces are shared with Python nuvs, and
 * a restored blob's one top-level entry is named after the directory its writer
 * archived. `trimmed/`, `reference_index/` and `subtraction_indexes/{id}/` are
 * therefore fixed names, not preferences.
 */

import { join } from "node:path";
import { INDEX_SQLITE_FILE_NAME } from "@virtool/workflow";

/** Where one subtraction's genome and its bowtie2 index live. */
export type SubtractionPaths = {
	/** The directory archived into the subtraction mapping-index cache */
	dir: string;

	/**
	 * The gzipped source genome, as downloaded from object storage.
	 *
	 * Kept outside {@link dir}: that directory is what the cache archives, and
	 * mixing the genome into it would cache the genome too.
	 */
	fasta: string;

	/** The bowtie2 index prefix — the shards sit beside it */
	indexPrefix: string;
};

/** Every path one nuvs run uses. */
export type NuvsPaths = {
	/** The reference index artifact, as downloaded from object storage */
	sourceIndex: (indexId: number) => string;

	/** One of the sample's reads files, by the name the row carries */
	read: (name: string) => string;

	/** The default-isolate FASTA `create_reference_fasta` writes */
	referenceFasta: string;

	/** The bowtie2 index prefix over {@link referenceFasta} */
	referenceIndexPrefix: string;

	/** The directory archived into the trimmed-reads cache */
	trimmedDir: string;

	/** One of the trimmed reads files, by pair position (1-based) */
	trimmedRead: (position: number) => string;

	subtraction: (subtractionId: number) => SubtractionPaths;

	/** Reads that did not align to the reference, written by `bowtie2 --un` */
	unmappedOtus: string;

	/** The FASTQ carried from one subtraction pass to the next */
	workingOtus: string;

	/** The reads left after every subtraction has been eliminated */
	unmappedSubtractions: string;

	/** One half of the re-paired reads, by pair position (1-based) */
	unmappedPair: (position: number) => string;

	/** SPAdes' output directory */
	spadesDir: string;

	/** The scaffolds SPAdes writes */
	spadesScaffolds: string;

	/**
	 * The same scaffolds, under the name `process_assembly` reads them from.
	 *
	 * Python renames rather than copies, and does it *after* `assemble` has
	 * already compressed the original — so the rename is what makes the
	 * uncompressed scaffolds readable by exactly one step.
	 */
	assemblyFasta: string;

	/** The compressed assembly, one of the three files the analysis retains */
	compressedAssembly: string;

	/** The ORF translations handed to `hmmscan` */
	orfsFasta: string;

	/** The compressed ORFs, one of the three files the analysis retains */
	compressedOrfs: string;

	/** `hmmscan --tblout` output, one of the three files the analysis retains */
	hmmTable: string;

	/** The directory `hmmpress` writes its indexes into, beside the profiles */
	hmmsDir: string;

	/** The vFam profile HMMs, as downloaded from object storage */
	hmmProfiles: string;

	/** The gzipped annotations blob, as downloaded from object storage */
	compressedHmmAnnotations: string;

	/** Where cache archives are staged, on the volume the pod is sized for */
	cacheStaging: string;

	/** The run's work path, for the places that need it whole */
	root: string;
};

/**
 * The trimmed reads, in pair order.
 *
 * Derived from `paired` rather than from the sample's own read count, matching
 * Python's `trimmed_read_paths` fixture: skewer names its output by position and
 * these are the names it was renamed to, so there is nothing here to read off
 * the row.
 */
export function trimmedReadPaths(
	paths: NuvsPaths,
	paired: boolean,
): readonly string[] {
	return paired
		? [paths.trimmedRead(1), paths.trimmedRead(2)]
		: [paths.trimmedRead(1)];
}

export function workPaths(workPath: string): NuvsPaths {
	const trimmedDir = join(workPath, "trimmed");
	const spadesDir = join(workPath, "spades");
	const hmmsDir = join(workPath, "hmms");
	const orfsFasta = join(workPath, "orfs.fa");

	return {
		root: workPath,

		sourceIndex: (indexId) =>
			join(workPath, "indexes", String(indexId), INDEX_SQLITE_FILE_NAME),

		read: (name) => join(workPath, "reads", name),

		referenceFasta: join(workPath, "reference.fa"),
		referenceIndexPrefix: join(workPath, "reference_index", "reference"),

		trimmedDir,
		trimmedRead: (position) => join(trimmedDir, `reads_${position}.fq.gz`),

		subtraction: (subtractionId) => {
			const dir = join(workPath, "subtraction_indexes", String(subtractionId));

			return {
				dir,
				fasta: join(
					workPath,
					"subtractions",
					String(subtractionId),
					"subtraction.fa.gz",
				),
				indexPrefix: join(dir, "subtraction"),
			};
		},

		unmappedOtus: join(workPath, "unmapped_otus.fq"),
		workingOtus: join(workPath, "working_otus.fq"),
		unmappedSubtractions: join(workPath, "unmapped_subtractions.fq"),
		unmappedPair: (position) => join(workPath, `unmapped_${position}.fq`),

		spadesDir,
		spadesScaffolds: join(spadesDir, "scaffolds.fasta"),
		assemblyFasta: join(spadesDir, "scaffolds.fa"),
		compressedAssembly: join(workPath, "assembly.fa.gz"),

		orfsFasta,
		compressedOrfs: `${orfsFasta}.gz`,

		hmmTable: join(workPath, "hmm.tsv"),
		hmmsDir,
		hmmProfiles: join(hmmsDir, "profiles.hmm"),
		compressedHmmAnnotations: join(hmmsDir, "annotations.json.gz"),

		cacheStaging: join(workPath, "caches"),
	};
}
