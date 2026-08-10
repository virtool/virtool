/**
 * Seeded fixture builders, replacing `pytest_plugin/data.py`.
 *
 * Every builder takes `(overrides, seed)` and returns a plain object. Two calls
 * with the same seed produce identical values, which is what makes a checksum
 * usable as an assertion.
 *
 * The resource shapes are the `Workflow*` ones from `@virtool/contracts` — what
 * the jobs API actually serves a workflow — not the wider shapes the SPA reads.
 * A builder that produced a shape no endpoint returns would let a workflow test
 * pass against fields the real run cannot see.
 */

import type {
	JobClaim,
	JobClaimed,
	JobStep,
	Quality,
	UserNested,
	WorkflowAnalysis,
	WorkflowIndex,
	WorkflowJob,
	WorkflowReference,
	WorkflowSample,
	WorkflowSampleRead,
	WorkflowSettings,
	WorkflowSubtraction,
	WorkflowSubtractionFile,
} from "@virtool/contracts";
import { createSeededRandom, DEFAULT_SEED, type SeededRandom } from "./random";

/**
 * The instant every fixture timestamp carries, as ISO-8601.
 *
 * Python pins `2015-10-06T20:00:00Z` and gets there by monkeypatching
 * `virtool.utils.timestamp`. Nothing is patched here — the value is injected,
 * and a fixture that wants a different one passes an override.
 *
 * A string rather than a `Date` on purpose: a shared `Date` is module-level
 * mutable state, and one test calling `setUTCFullYear` on it would silently
 * move every other test's fixtures.
 */
export const STATIC_TIME = "2015-10-06T20:00:00Z";

/** A fresh {@link STATIC_TIME} `Date`. Never a shared instance. */
export function staticTime(): Date {
	return new Date(STATIC_TIME);
}

/**
 * The files a finished subtraction carries, from `pytest_plugin/utils.py`.
 *
 * The source genome plus the six Bowtie2 shards `bowtie2-build` writes. A
 * workflow reading a subtraction branches on this list, so a fixture short of a
 * shard tests a subtraction that could not actually be aligned against.
 */
export const SUBTRACTION_FILENAMES = [
	"subtraction.fa.gz",
	"subtraction.1.bt2",
	"subtraction.2.bt2",
	"subtraction.3.bt2",
	"subtraction.4.bt2",
	"subtraction.rev.1.bt2",
	"subtraction.rev.2.bt2",
] as const;

/** The two reads files a paired sample is made of. */
export const SAMPLE_READ_FILENAMES = [
	"reads_1.fq.gz",
	"reads_2.fq.gz",
] as const;

const HANDLES = ["bob", "fred", "leeashley", "zclark", "kmiller"];

const ORGANISMS = ["virus", "viroid", "bacteria", "fungus"];

/**
 * A storage key in the shape `mintStorageKey` produces, drawn from the seed.
 *
 * `mintStorageKey` itself is `randomUUID`-backed, so a builder calling it would
 * lose the determinism a checksum assertion stands on. What the minting rule is
 * actually protecting is preserved: the leaf is a uuid-shaped opaque string that
 * no fixture can compose from a row id, so code that guesses a key rather than
 * reading it out of metadata still finds nothing.
 *
 * These are placeholders for a row nothing was written for. A test that seeds
 * real bytes overwrites them with the key `createTestStorage`'s helper returns,
 * and that one *is* minted.
 */
function seededStorageKey(
	random: SeededRandom,
	domain: string,
	parentId: number,
): string {
	return `${domain}/${parentId}/${random.hex(32)}`;
}

/** A user embedded in another resource. */
export function createFakeUser(
	overrides: Partial<UserNested> = {},
	seed: number = DEFAULT_SEED,
): UserNested {
	const random = createSeededRandom(seed);

	return {
		id: random.int(1, 999),
		handle: random.pick(HANDLES),
		...overrides,
	};
}

/** The claim metadata a runner sends and the jobs API stores. */
export function createFakeJobClaim(
	overrides: Partial<JobClaim> = {},
	seed: number = DEFAULT_SEED,
): JobClaim {
	const random = createSeededRandom(seed);

	return {
		runnerId: `runner-${random.hex(8)}`,
		mem: 8,
		cpu: 2,
		image: "ghcr.io/virtool/ts-create-subtraction:1.0.0",
		runtimeVersion: "1.0.0",
		workflowVersion: "1.0.0",
		...overrides,
	};
}

/**
 * The step list a claimed job carries.
 *
 * Ids are `snake_case` because they are the Python function names the ported
 * steps were carried over from, and the jobs API stores them verbatim.
 */
export function createFakeJobSteps(): JobStep[] {
	return [
		{
			id: "prepare",
			name: "Prepare",
			description: "Prepare the run.",
			startedAt: null,
		},
		{
			id: "run",
			name: "Run",
			description: "Do the work.",
			startedAt: null,
		},
	];
}

/** A job as the lifecycle endpoints return it. */
export function createFakeJob(
	overrides: Partial<WorkflowJob> = {},
	seed: number = DEFAULT_SEED,
): WorkflowJob {
	const random = createSeededRandom(seed);

	return {
		id: random.int(1, 999),
		args: {},
		claim: createFakeJobClaim({}, seed),
		claimedAt: staticTime(),
		createdAt: staticTime(),
		pingedAt: staticTime(),
		progress: 0,
		state: "running",
		steps: createFakeJobSteps(),
		user: createFakeUser({}, seed),
		workflow: "create_subtraction",
		...overrides,
	};
}

/** The response `POST /jobs/claim` returns, key and all. */
export function createFakeJobClaimed(
	overrides: Partial<JobClaimed> = {},
	seed: number = DEFAULT_SEED,
): JobClaimed {
	const random = createSeededRandom(seed);
	const job = createFakeJob({}, seed);

	return {
		id: job.id,
		acquired: true,
		claim: createFakeJobClaim({}, seed),
		claimedAt: staticTime(),
		createdAt: staticTime(),
		key: random.hex(32),
		state: "running",
		steps: createFakeJobSteps(),
		user: job.user,
		workflow: job.workflow,
		...overrides,
	};
}

/** A FastQC quality blob, small enough to read in a failure message. */
export function createFakeQuality(
	overrides: Partial<Quality> = {},
	seed: number = DEFAULT_SEED,
): Quality {
	const random = createSeededRandom(seed);

	return {
		bases: [
			[random.int(30, 40), random.int(30, 40)],
			[random.int(30, 40), random.int(30, 40)],
		],
		composition: [
			[random.int(0, 100), random.int(0, 100)],
			[random.int(0, 100), random.int(0, 100)],
		],
		count: random.int(1000, 9999),
		encoding: "Sanger / Illumina 1.9",
		gc: random.int(30, 60),
		length: [75, 150],
		sequences: [random.int(0, 500), random.int(0, 500)],
		...overrides,
	};
}

/**
 * A finished, paired sample with both reads files stored.
 *
 * The keys are minted rather than composed, so a fixture cannot reach the bytes
 * without reading them out of this metadata — see `createTestStorage`, which
 * seeds the objects and hands back the keys to attach here.
 */
export function createFakeSample(
	overrides: Partial<WorkflowSample> = {},
	seed: number = DEFAULT_SEED,
): WorkflowSample {
	const random = createSeededRandom(seed);
	const id = random.int(1, 999);

	const reads: WorkflowSampleRead[] = SAMPLE_READ_FILENAMES.map(
		(name, index) => ({
			id: id * 10 + index,
			name,
			size: random.int(1_000_000, 9_999_999),
			storageKey: seededStorageKey(random, "samples", id),
		}),
	);

	return {
		id,
		libraryType: "normal",
		name: `Sample ${id}`,
		paired: true,
		quality: createFakeQuality({}, seed),
		reads,
		...overrides,
	};
}

/**
 * A sample the `create_sample` workflow has not finished yet.
 *
 * No quality, and no reads: the files it will build are still uploads named in
 * the job's `args`, and the sample row carries nothing until finalize. Python's
 * `new_sample` fixture carried the two `reads_{1,2}.fq.gz` uploads on the
 * sample itself, which is not how this side reads them.
 */
export function createFakeNewSample(
	overrides: Partial<WorkflowSample> = {},
	seed: number = DEFAULT_SEED,
): WorkflowSample {
	return createFakeSample({ quality: null, reads: [], ...overrides }, seed);
}

/** A built subtraction, with its source genome and all six Bowtie2 shards. */
export function createFakeSubtraction(
	overrides: Partial<WorkflowSubtraction> = {},
	seed: number = DEFAULT_SEED,
): WorkflowSubtraction {
	const random = createSeededRandom(seed);
	const id = random.int(1, 999);

	const files: WorkflowSubtractionFile[] = SUBTRACTION_FILENAMES.map(
		(name, index) => ({
			id: id * 10 + index,
			name,
			size: random.int(1_000, 9_999_999),
			storageKey: seededStorageKey(random, "subtractions", id),
			type: name.endsWith(".fa.gz") ? "fasta" : "bowtie2",
		}),
	);

	return {
		id,
		count: random.int(1, 100),
		files,
		gc: { a: 0.25, c: 0.25, g: 0.25, t: 0.24, n: 0.01 },
		name: `Subtraction ${id}`,
		nickname: "",
		ready: true,
		...overrides,
	};
}

/**
 * A subtraction the `create_subtraction` workflow has not finished yet.
 *
 * `ready: false` with no counts and no files — the state the workflow reads at
 * its first step, and the one a test asserting on finalize has to start from.
 */
export function createFakeNewSubtraction(
	overrides: Partial<WorkflowSubtraction> = {},
	seed: number = DEFAULT_SEED,
): WorkflowSubtraction {
	return createFakeSubtraction(
		{ count: null, files: [], gc: null, ready: false, ...overrides },
		seed,
	);
}

/** A reference, as a workflow reads it. */
export function createFakeReference(
	overrides: Partial<WorkflowReference> = {},
	seed: number = DEFAULT_SEED,
): WorkflowReference {
	const random = createSeededRandom(seed);
	const id = random.int(1, 999);

	return {
		id,
		dataType: "genome",
		description: "",
		name: `Reference ${id}`,
		organism: random.pick(ORGANISMS),
		...overrides,
	};
}

/**
 * A built index, carrying the SQLite artifact a workflow reads its reference
 * out of.
 *
 * `index_files.storage_key` is `NOT NULL`, so this key is never null — the one
 * file reference on this wire that is not.
 */
export function createFakeIndex(
	overrides: Partial<WorkflowIndex> = {},
	seed: number = DEFAULT_SEED,
): WorkflowIndex {
	const random = createSeededRandom(seed);
	const id = random.int(1, 999);
	const reference = createFakeReference({}, seed);

	return {
		id,
		files: [
			{
				id: id * 10,
				name: "virtool-index-sqlite-v1.sqlite",
				size: random.int(1_000, 999_999),
				storageKey: seededStorageKey(random, "indexes", id),
				type: "json",
			},
		],
		// Keyed by legacy Mongo OTU id, straight out of a JSONB column.
		manifest: { [random.hex(8)]: 0, [random.hex(8)]: 2 },
		ready: true,
		reference: { id: reference.id, name: reference.name },
		version: random.int(0, 9),
		...overrides,
	};
}

/**
 * An analysis wired to a sample, index, reference and subtraction.
 *
 * The relationships Python's `data.py` set up by hand. Pass the fixtures it
 * should point at rather than letting it mint its own, so the ids a test
 * asserts on are the ones it seeded.
 */
export function createFakeAnalysis(
	overrides: Partial<WorkflowAnalysis> = {},
	seed: number = DEFAULT_SEED,
): WorkflowAnalysis {
	const random = createSeededRandom(seed);
	const index = createFakeIndex({}, seed);
	const reference = createFakeReference({}, seed);
	const sample = createFakeSample({}, seed);
	const subtraction = createFakeSubtraction({}, seed);

	return {
		id: random.int(1, 999),
		index: { id: index.id, version: index.version },
		ready: false,
		reference: { id: reference.id, name: reference.name },
		sample: { id: sample.id, name: sample.name },
		subtractions: [{ id: subtraction.id, name: subtraction.name }],
		workflow: "pathoscope",
		...overrides,
	};
}

/** The instance settings singleton, as a workflow reads it. */
export function createFakeSettings(
	overrides: Partial<WorkflowSettings> = {},
): WorkflowSettings {
	return {
		defaultSourceTypes: ["isolate", "strain"],
		enableSentry: false,
		minimumPasswordLength: 8,
		sampleAllRead: true,
		sampleAllWrite: false,
		sampleGroup: "none",
		sampleGroupRead: true,
		sampleGroupWrite: false,
		...overrides,
	};
}
