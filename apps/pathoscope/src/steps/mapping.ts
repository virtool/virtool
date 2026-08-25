import { mkdir } from "node:fs/promises";
import { openWorkflowIndex, writeFasta } from "@virtool/sqlite";
import { buildBowtie2Index } from "@virtool/workflow";
import { findCandidateSequenceIds } from "../pathoscopeCore";
import { workPaths } from "../paths";
import { pipeline, quote } from "../shell";
import type { PathoscopeStep } from "./types";

/**
 * Find the OTUs the sample's reads could plausibly belong to.
 *
 * `pathoscope-core` drives bowtie2 itself here and streams the SAM as it comes,
 * so a full alignment against every source sequence never lands on disk and
 * never enters this process.
 */
export const mapRepresentativesStep: PathoscopeStep = {
	id: "map_representatives",
	description:
		"Map sample reads to reference representatives to identify candidate OTUs.",
	async run({ data, logger, proc, runSubprocess, state, workPath }) {
		const paths = workPaths(workPath);

		const candidateSequenceIds = await findCandidateSequenceIds(
			{ runSubprocess, outputPath: paths.coreResults("candidates") },
			{
				indexPrefix: paths.representativeIndexPrefix,
				pScoreCutoff: data.pScoreCutoff,
				proc,
				readPaths: data.reads.map((read) => read.path),
			},
		);

		const source = openWorkflowIndex({
			id: data.index.id,
			path: data.index.path,
		});

		try {
			const otuRefs =
				await source.getOtuRefsBySequenceIds(candidateSequenceIds);

			state.candidateOtuIds = [
				...new Set(Object.values(otuRefs).map((otuRef) => otuRef.id)),
			].sort();
		} finally {
			source.close();
		}

		logger.info(
			{ count: state.candidateOtuIds.length },
			"found candidate otus",
		);
	},
};

/**
 * Build a second index holding every surviving isolate of every candidate OTU.
 *
 * The first pass narrowed the reference to a handful of OTUs; this one restores
 * the isolate-level detail for just those, which is what makes an isolate-level
 * result affordable.
 */
export const buildCandidateOtuIndexStep: PathoscopeStep = {
	id: "build_candidate_otu_index",
	description:
		"Build a mapping index containing surviving isolates of candidate OTUs.",
	async run({ data, logger, proc, runSubprocess, state, workPath }) {
		const paths = workPaths(workPath);

		// `bowtie2-build` exits 1 on an empty FASTA, and every step after this one
		// short-circuits on the same condition.
		if (state.candidateOtuIds.length === 0) {
			logger.info("no candidate otus; skipping isolate index");

			return;
		}

		const collapsed = openWorkflowIndex({
			id: data.index.id,
			path: paths.collapsedReference,
		});

		try {
			await mkdir(paths.isolatesDir, { recursive: true });

			await writeFasta(
				paths.candidateOtuFasta,
				collapsed.iterOtuSequences(state.candidateOtuIds),
			);

			logger.info(
				{ otuCount: state.candidateOtuIds.length },
				"wrote isolate fasta",
			);
		} finally {
			collapsed.close();
		}

		await buildBowtie2Index(
			runSubprocess,
			paths.candidateOtuFasta,
			paths.candidateOtuIndexPrefix,
			proc,
		);
	},
};

/**
 * Align the sample against the isolate index.
 *
 * Run as a shell pipeline so the SAM stream goes straight into `samtools` and is
 * never written out. The runtime's runner never takes a shell string, so
 * `bash -c` is explicit here, and every interpolated path is quoted — the read
 * paths end in a name the sample's rows carry.
 *
 * `-k 100` keeps up to a hundred alignments per read, which is the point — the
 * multi-mapping reads are exactly what expectation maximization later reassigns.
 */
export const mapIsolatesStep: PathoscopeStep = {
	id: "map_isolates",
	description: "Map sample reads to the candidate isolate index.",
	async run({ data, logger, proc, runSubprocess, state, workPath }) {
		const paths = workPaths(workPath);

		if (state.candidateOtuIds.length === 0) {
			logger.info("no candidate otus; skipping isolate mapping");

			return;
		}

		// Comma-joined, unlike the repeated `--reads` the candidate search takes.
		// `bowtie2 -U` reads one comma-separated list. Each path is quoted on its
		// own so the commas stay the separators bowtie2 splits on.
		const reads = data.reads.map((read) => quote(read.path)).join(",");

		const bowtie2 = [
			"bowtie2",
			`-p ${proc}`,
			"--no-unal",
			"--local",
			"--score-min L,20,1.0",
			"-N 0",
			"-L 15",
			"-k 100",
			`--al ${quote(paths.isolateFastq)}`,
			`-x ${quote(paths.candidateOtuIndexPrefix)}`,
			`-U ${reads}`,
		].join(" ");

		const samtools = `samtools view -bS - -o ${quote(paths.isolateBam)}`;

		await runSubprocess({
			command: ["bash", "-c", pipeline(bowtie2, samtools)],
		});

		logger.info({ path: paths.isolateBam }, "mapped reads to isolates");
	},
};
