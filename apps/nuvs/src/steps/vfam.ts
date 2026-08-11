import { parseHmmerTblout } from "@virtool/bio";
import type {
	AnalysisFileManifest,
	FinalizeAnalysisRequest,
	JsonObject,
} from "@virtool/contracts";
import { mintStorageKey, type StorageBackend } from "@virtool/storage";
import {
	downloadToPath,
	type JobsApiClient,
	uploadFromPath,
	WorkflowError,
} from "@virtool/workflow";
import { HmmClusterUnknownError, readHmmClusterMap } from "../hmms";
import { type NuvsPaths, workPaths } from "../paths";
import { readLines } from "../sequences";
import type { NuvsRawContig, NuvsRawOrfHit } from "../state";
import type { NuvsStep } from "./types";

/**
 * Search the ORF translations for viral motifs, and finalize the analysis.
 *
 * `hmmscan` is what turns a contig into a *finding*: an ORF that matches a vFam
 * profile is the evidence that this contig is a virus rather than assembly
 * noise. Each match is joined back to a Virtool annotation through its vFam
 * cluster, and the annotation's **id alone** is recorded — the formatting layer
 * merges `cluster`, `families` and `names` in from the `hmms` table when the
 * analysis is read.
 *
 * **This is the only step that finalizes**, and the only one that uploads. The
 * three retained files go to storage here rather than as each is produced, so a
 * run that fails at any earlier step leaves no objects behind that no row names.
 */
export const vfamStep: NuvsStep = {
	id: "vfam",
	name: "VFam",
	description: "Search for viral motifs in ORF translations.",
	async run({
		client,
		data,
		logger,
		proc,
		runSubprocess,
		state,
		storage,
		workPath,
	}) {
		const paths = workPaths(workPath);

		await Promise.all([
			downloadToPath(storage, data.hmms.profilesKey, data.hmms.profilesPath),
			downloadToPath(
				storage,
				data.hmms.annotationsKey,
				data.hmms.annotationsPath,
			),
		]);

		logger.info("downloaded hmm profiles and annotations");

		// `hmmpress` writes its four binary indexes beside the profiles, and
		// `hmmscan` will not run without them.
		await runSubprocess({ command: ["hmmpress", data.hmms.profilesPath] });

		await runSubprocess({
			command: [
				"hmmscan",
				"--tblout",
				paths.hmmTable,
				"--noali",
				// One core is left for this process, which is reading nothing while
				// hmmscan runs but still has to answer the ping loop.
				"--cpu",
				String(proc - 1),
				data.hmms.profilesPath,
				paths.orfsFasta,
			],
		});

		const clusters = await readHmmClusterMap(data.hmms.annotationsPath);

		await annotate(paths.hmmTable, clusters, state.hits);

		logger.info(
			{ contigCount: state.hits.length },
			"annotated open reading frames",
		);

		await finalize({
			analysisId: data.analysisId,
			client,
			paths,
			results: { hits: state.hits },
			storage,
		});

		logger.info({ analysisId: data.analysisId }, "finalized analysis");
	},
};

/**
 * Attach each `hmmscan` hit to the ORF it was found in.
 *
 * The contig and ORF indexes come back out of the target name
 * `process_assembly` wrote, so a hit addresses a position in a list this run
 * built. An index that does not exist means the two disagree — which cannot
 * happen from one run's own files, and is worth a named failure rather than an
 * `undefined` that would silently drop the match.
 *
 * **Python's `hits.remove(sequence)` branch is not ported.** It drops a contig
 * whose ORFs all ended up with empty hit lists, but it only ever runs for a
 * contig that just received a non-empty list, so the condition is never true. It
 * reads like a mutate-while-iterating bug and is in fact dead; porting it as
 * though it fires would renumber the contigs and invalidate every stored index.
 */
async function annotate(
	tablePath: string,
	clusters: ReadonlyMap<number, number>,
	contigs: NuvsRawContig[],
): Promise<void> {
	const lines: string[] = [];

	for await (const line of readLines(tablePath)) {
		lines.push(line);
	}

	for (const hit of parseHmmerTblout(lines)) {
		const contig = contigs[hit.sequenceIndex];
		const orf = contig?.orfs[hit.orfIndex];

		if (!orf) {
			throw new WorkflowError(
				`hmmscan reported a hit against sequence_${hit.sequenceIndex}.${hit.orfIndex}, which this run's assembly has no ORF for`,
			);
		}

		const annotationId = clusters.get(hit.cluster);

		if (annotationId === undefined) {
			throw new HmmClusterUnknownError(hit.cluster);
		}

		// `cluster`, `sequenceIndex` and `orfIndex` are how the hit was addressed
		// and are deliberately not stored: the first is the server's to merge in
		// from the annotation, and the other two are the position it is already at.
		orf.hits.push({
			best_bias: hit.best_bias,
			best_e: hit.best_e,
			best_score: hit.best_score,
			full_bias: hit.full_bias,
			full_e: hit.full_e,
			full_score: hit.full_score,
			hit: annotationId,
		} satisfies NuvsRawOrfHit);
	}
}

/** The three files a NuVs analysis retains, in the order they were produced. */
const RETAINED_FILES: ReadonlyArray<{
	format: AnalysisFileManifest["format"];
	name: string;
	path: (paths: NuvsPaths) => string;
}> = [
	{
		format: "fasta",
		name: "assembly.fa.gz",
		path: (paths) => paths.compressedAssembly,
	},
	{
		format: "fasta",
		name: "orfs.fa.gz",
		path: (paths) => paths.compressedOrfs,
	},
	{ format: "tsv", name: "hmm.tsv", path: (paths) => paths.hmmTable },
];

/**
 * Upload the retained files and record the run's output against the analysis.
 *
 * **The key is minted here and sent, never composed by the route.** The jobs API
 * checks it sits under this analysis's own prefix and then records it verbatim,
 * so there is one opinion about where the bytes went rather than two.
 *
 * Unlike pathoscope, whose manifest is legitimately empty, NuVs always has all
 * three files — `results` and the manifest are written by the same call, so an
 * analysis cannot end up `ready` with its file rows missing.
 */
async function finalize({
	analysisId,
	client,
	paths,
	results,
	storage,
}: {
	analysisId: number;
	client: JobsApiClient;
	paths: NuvsPaths;
	results: JsonObject;
	storage: StorageBackend;
}): Promise<void> {
	const files: AnalysisFileManifest[] = await Promise.all(
		RETAINED_FILES.map(async ({ format, name, path }) => {
			const storageKey = mintStorageKey("analyses", analysisId);

			await uploadFromPath(storage, storageKey, path(paths));

			return {
				description: null,
				format,
				kind: "analysisFile" as const,
				name,
				storageKey,
			};
		}),
	);

	const body: FinalizeAnalysisRequest = { files, results };

	await client.request({
		method: "PATCH",
		path: `/analyses/${analysisId}`,
		body,
	});
}
