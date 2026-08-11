/**
 * A run context for a single step, over a real work path.
 *
 * Steps here read and write files, so a fake filesystem would test the mocks
 * rather than the step. Everything a step reaches that is *not* the filesystem —
 * the subprocess runner, the jobs API, storage — is faked, and the caller gets
 * each of them back to assert on.
 *
 * Not a test file: it is imported by them. `vitest.config.ts` includes only
 * `*.test.ts`, so this is never collected as a suite.
 */

import type { LibraryType } from "@virtool/contracts";
import type { WorkflowContext } from "@virtool/workflow";
import {
	createFakeAnalysis,
	createFakeContext,
	createFakeJobsApiClient,
	createFakeSubprocessRunner,
	createJobsApiState,
	createTestStorage,
	createTestWorkPath,
} from "@virtool/workflow/testing";
import { onTestFinished } from "vitest";
import type { NuvsData, NuvsSubtraction } from "../context";
import { workPaths } from "../paths";
import { createNuvsState, type NuvsRawContig } from "../state";

export const ANALYSIS_ID = 11;
export const INDEX_ID = 22;
export const SAMPLE_ID = 33;

/** What {@link setupStep} varies between tests. */
export type SetupStepOptions = {
	hits?: NuvsRawContig[];
	libraryType?: LibraryType;
	maxLength?: number;
	paired?: boolean;
	subtractionCount?: number;
};

function createSubtraction(id: number, workPath: string): NuvsSubtraction {
	return {
		id,
		name: `Sub ${id}`,
		storageKey: `subtractions/${id}/genome`,
		path: workPaths(workPath).subtraction(id).fasta,
	};
}

export async function setupStep({
	hits = [],
	libraryType = "normal",
	maxLength = 150,
	paired = true,
	subtractionCount = 0,
}: SetupStepOptions = {}) {
	const { path: workPath, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const paths = workPaths(workPath);
	const runSubprocess = createFakeSubprocessRunner();
	const jobsApiState = createJobsApiState();
	const client = createFakeJobsApiClient(jobsApiState);
	const testStorage = createTestStorage();

	// The finalize route reads the analysis before updating it, the way the real
	// one does, so a step that finalizes needs the row to exist.
	jobsApiState.analyses.set(
		ANALYSIS_ID,
		createFakeAnalysis({
			id: ANALYSIS_ID,
			index: { id: INDEX_ID, version: 3 },
			sample: { id: SAMPLE_ID, name: "Sample" },
			subtractions: [],
			workflow: "nuvs",
		}),
	);

	const data: NuvsData = {
		analysisId: ANALYSIS_ID,
		hmms: {
			annotationsKey: "hmm/annotations.json.gz",
			annotationsPath: paths.compressedHmmAnnotations,
			profilesKey: "hmm/profiles.hmm",
			profilesPath: paths.hmmProfiles,
		},
		index: {
			id: INDEX_ID,
			storageKey: `indexes/${INDEX_ID}/artifact`,
			path: paths.sourceIndex(INDEX_ID),
		},
		reads: [
			{ storageKey: "samples/33/one", path: paths.read("reads_1.fq.gz") },
			{ storageKey: "samples/33/two", path: paths.read("reads_2.fq.gz") },
		],
		sample: { id: SAMPLE_ID, libraryType, maxLength, paired },
		subtractions: Array.from({ length: subtractionCount }, (_, index) =>
			createSubtraction(index + 1, workPath),
		),
	};

	const state = { ...createNuvsState(), hits };

	const context: WorkflowContext<NuvsData, typeof state> = createFakeContext(
		data,
		state,
		{ client, runSubprocess, storage: testStorage.storage, workPath },
	);

	return {
		client,
		context,
		data,
		jobsApiState,
		paths,
		runSubprocess,
		state,
		testStorage,
		workPath,
	};
}

/** A FASTQ file body, one four-line record per id. */
export function fastq(...readIds: readonly string[]): string {
	return readIds.map((id) => `@${id}\nACGT\n+\nIIII\n`).join("");
}

/** The ids of every record in a FASTQ body. */
export function parseFastqIds(contents: string): string[] {
	const lines = contents.split("\n");
	const ids: string[] = [];

	for (let index = 0; index + 3 < lines.length; index += 4) {
		ids.push((lines[index] ?? "").slice(1).split(/\s+/)[0] ?? "");
	}

	return ids;
}

/** The value following `flag` in a command. */
export function flagValue(
	command: readonly string[],
	flag: string,
): string | undefined {
	return command[command.indexOf(flag) + 1];
}
