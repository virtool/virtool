import type {
	Analysis,
	AnalysisFile,
	AnalysisFormat,
	AnalysisJobNested,
	AnalysisMinimal,
	AnalysisSearchResult,
	AnalysisWorkflow,
	JsonObject,
	NuvsBlast,
	SubtractionNested,
	UserNested,
} from "@virtool/contracts";
import { isJobStateTerminal } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import { deleteKeys, type StorageBackend } from "@virtool/storage";
import { and, asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import {
	analyses,
	analysisFiles,
	analysisSubtractions,
	nuvsBlast,
} from "../db/schema/analyses";
import { indexes } from "../db/schema/indexes";
import { jobs } from "../db/schema/jobs";
import { legacyReferences } from "../db/schema/references";
import { legacySamples } from "../db/schema/samples";
import { subtractions } from "../db/schema/subtractions";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { createJob, getJobs } from "../jobs/data";
import {
	type SampleActor,
	sampleReadableFilter,
	sampleStorageId,
} from "../samples/data";
import { formatAnalysis } from "./format";

/** Filters and pagination accepted by {@link findAnalyses}. */
export type FindAnalysesOptions = {
	page: number;
	perPage: number;
	/** Restrict the page to one sample's analyses. */
	sampleId?: number;
	/** Restrict the page to the analyses one user started. */
	userId?: number;
};

/** The fields an analysis is created from, plus the user starting it. */
export type CreateAnalysisValues = {
	sampleId: number;
	referenceId: number;
	subtractionIds: number[];
	workflow: AnalysisWorkflow;
	userId: number;
};

/** A result file a workflow wrote, as {@link finalizeAnalysis} records it. */
export type AnalysisFileValues = {
	name: string;
	format: AnalysisFormat;
	description: string | null;

	/** The byte count the caller read back from storage, never a declared one. */
	size: number;

	/** The complete key the workflow wrote to, recorded verbatim. */
	storageKey: string;
};

/** Fields a workflow supplies when it finishes an analysis. */
export type FinalizeAnalysisValues = {
	/** The workflow's output, opaque here and interpreted by the format layer. */
	results: JsonObject;
	files: AnalysisFileValues[];
};

/** Thrown when a requested analysis does not exist. */
export class AnalysisNotFoundError extends AppError {}

/** Thrown when an analysis has already been finalized. */
export class AnalysisAlreadyFinalizedError extends AppError {}

/** Thrown when an operation requires a finished analysis and it is still running. */
export class AnalysisRunningError extends AppError {}

/** Thrown when a NuVs-only operation is attempted on another workflow. */
export class AnalysisNotNuvsError extends AppError {}

/** Thrown when a NuVs analysis has no contig at the requested sequence index. */
export class AnalysisSequenceNotFoundError extends AppError {}

/** Thrown when a create names a sample, reference, or subtraction that does not exist. */
export class AnalysisRelationNotFoundError extends AppError {}

/** Thrown when a create names an archived reference, which accepts no new analyses. */
export class AnalysisReferenceArchivedError extends AppError {}

/**
 * Thrown when a reference has no ready index to analyse against. An analysis
 * without an index cannot be read back, so creating one is refused rather than
 * left to fail on the next read.
 */
export class AnalysisNoReadyIndexError extends AppError {}

/**
 * Thrown when a stored analysis cannot be read back — an `index_id` that does
 * not resolve to a build, an absent reference, an absent parent sample. Each
 * supplies something every response carries, so this surfaces rather than
 * fabricating a placeholder or dropping the row from a list.
 */
export class AnalysisIntegrityError extends AppError {}

// The columns a list view selects. The TOASTed `results` column is deliberately
// excluded: it is the largest thing in the row and no list renders it.
const minimalColumns = {
	id: analyses.id,
	created_at: analyses.created_at,
	updated_at: analyses.updated_at,
	workflow: analyses.workflow,
	ready: analyses.ready,
	sample_id: analyses.sample_id,
	reference_id: analyses.reference_id,
	index_id: analyses.index_id,
	user_id: analyses.user_id,
	job_id: analyses.job_id,
};

type MinimalRow = {
	id: number;
	created_at: Date;
	updated_at: Date;
	workflow: string;
	ready: boolean;
	sample_id: number | null;
	reference_id: number | null;
	index_id: number | null;
	user_id: number;
	job_id: number | null;
	indexVersion: number | null;
	referenceName: string | null;
	sampleName: string | null;
	userHandle: string | null;
};

async function getSubtractionsByAnalysis(
	db: DbOrTx,
	analysisIds: number[],
): Promise<Map<number, SubtractionNested[]>> {
	if (analysisIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			analysisId: analysisSubtractions.analysis_id,
			id: subtractions.id,
			name: subtractions.name,
		})
		.from(analysisSubtractions)
		.innerJoin(
			subtractions,
			eq(subtractions.id, analysisSubtractions.subtraction_id),
		)
		.where(inArray(analysisSubtractions.analysis_id, analysisIds))
		.orderBy(asc(subtractions.name));

	const byAnalysis = new Map<number, SubtractionNested[]>();

	for (const row of rows) {
		const list = byAnalysis.get(row.analysisId) ?? [];
		list.push({ id: row.id, name: row.name });
		byAnalysis.set(row.analysisId, list);
	}

	return byAnalysis;
}

// The analysis's workflow job, reduced to the embedded shape. Reuses the jobs
// data layer so an analysis's job never disagrees with the jobs endpoints.
async function getAnalysisJobs(
	db: Db,
	jobIds: number[],
): Promise<Map<number, AnalysisJobNested>> {
	const jobs = await getJobs(db, jobIds);

	return new Map(
		jobs.map((job) => [
			job.id,
			{
				createdAt: job.createdAt,
				id: job.id,
				progress: job.progress,
				// The mirror stores states and workflows as free text; the columns only
				// ever hold the enumerated values, and an analysis's job is always the
				// job that ran its own workflow.
				state: job.state as AnalysisJobNested["state"],
				user: job.user,
				workflow: job.workflow as AnalysisWorkflow,
			},
		]),
	);
}

async function getAnalysisFiles(
	db: DbOrTx,
	analysisId: number,
): Promise<AnalysisFile[]> {
	const rows = await db
		.select()
		.from(analysisFiles)
		.where(eq(analysisFiles.analysis_id, analysisId))
		.orderBy(asc(analysisFiles.id));

	return rows.map((row) => ({
		analysis: analysisId,
		description: row.description,
		format: row.format ?? "",
		id: row.id,
		name: row.name ?? "",
		nameOnDisk: row.name_on_disk ?? "",
		size: row.size,
		uploadedAt: row.uploaded_at,
	}));
}

function mapMinimal(
	row: MinimalRow,
	analysisSubtractionList: SubtractionNested[],
	job: AnalysisJobNested | null,
): AnalysisMinimal {
	if (row.index_id === null || row.indexVersion === null) {
		throw new AnalysisIntegrityError(`Index not found for analysis ${row.id}`);
	}

	if (row.reference_id === null) {
		throw new AnalysisIntegrityError(
			`Reference not found for analysis ${row.id}`,
		);
	}

	// An analysis exists only as a child of a sample, and every response links to
	// it. Fabricating a placeholder id would render a link to a sample that
	// cannot exist, so an orphan surfaces here like the other two.
	if (row.sample_id === null) {
		throw new AnalysisIntegrityError(`Sample not found for analysis ${row.id}`);
	}

	const user: UserNested = { id: row.user_id, handle: row.userHandle ?? "" };

	return {
		createdAt: row.created_at,
		id: row.id,
		index: { id: row.index_id, version: row.indexVersion },
		job,
		ready: row.ready,
		reference: { id: row.reference_id, name: row.referenceName ?? "" },
		sample: { id: row.sample_id, name: row.sampleName ?? "" },
		subtractions: analysisSubtractionList,
		updatedAt: row.updated_at,
		user,
		workflow: row.workflow as AnalysisWorkflow,
	};
}

/**
 * The Postgres predicate scoping a list to the analyses `actor` may read.
 * Visibility is entirely derived from the parent sample's rights row — analyses
 * carry none of their own — so this is a semi-join onto the samples the actor
 * can read. Returns `undefined` for a full administrator, who sees every
 * analysis.
 */
function analysisReadableFilter(db: Db, actor: SampleActor): SQL | undefined {
	const readable = sampleReadableFilter(actor);

	if (!readable) {
		return undefined;
	}

	return inArray(
		analyses.sample_id,
		db.select({ id: legacySamples.id }).from(legacySamples).where(readable),
	);
}

export async function findAnalyses(
	db: Db,
	options: FindAnalysesOptions,
	actor: SampleActor,
): Promise<AnalysisSearchResult> {
	const filters: SQL[] = [];

	const readable = analysisReadableFilter(db, actor);
	if (readable) {
		filters.push(readable);
	}

	if (options.sampleId !== undefined) {
		filters.push(eq(analyses.sample_id, options.sampleId));
	}

	if (options.userId !== undefined) {
		filters.push(eq(analyses.user_id, options.userId));
	}

	const where = filters.length > 0 ? and(...filters) : undefined;

	const [foundRows, rows] = await Promise.all([
		db.select({ value: count() }).from(analyses).where(where),
		// The index, reference and owner are one-to-one, so they join onto the
		// analysis row. The index join is an outer join so an analysis whose index
		// cannot be resolved surfaces loudly in `mapMinimal` rather than silently
		// dropping out of the page.
		db
			.select({
				...minimalColumns,
				indexVersion: indexes.version,
				referenceName: legacyReferences.name,
				sampleName: legacySamples.name,
				userHandle: users.handle,
			})
			.from(analyses)
			.leftJoin(indexes, eq(indexes.id, analyses.index_id))
			.leftJoin(
				legacyReferences,
				eq(legacyReferences.id, analyses.reference_id),
			)
			.leftJoin(legacySamples, eq(legacySamples.id, analyses.sample_id))
			.leftJoin(users, eq(users.id, analyses.user_id))
			.where(where)
			.orderBy(desc(analyses.created_at), desc(analyses.id))
			.offset((options.page - 1) * options.perPage)
			.limit(options.perPage),
	]);

	const foundCount = foundRows[0]?.value ?? 0;

	const analysisIds = rows.map((row) => row.id);
	const jobIds = [
		...new Set(
			rows.map((row) => row.job_id).filter((id): id is number => id != null),
		),
	];

	const [subtractionsByAnalysis, jobsById] = await Promise.all([
		getSubtractionsByAnalysis(db, analysisIds),
		getAnalysisJobs(db, jobIds),
	]);

	return {
		foundCount,
		// Python reports the scoped count for both. Match it exactly.
		totalCount: foundCount,
		page: options.page,
		perPage: options.perPage,
		pageCount: foundCount ? Math.ceil(foundCount / options.perPage) : 0,
		items: rows.map((row) =>
			mapMinimal(
				row,
				subtractionsByAnalysis.get(row.id) ?? [],
				row.job_id != null ? (jobsById.get(row.job_id) ?? null) : null,
			),
		),
	};
}

/**
 * An analysis's metadata and its result files.
 *
 * The `results` blob is deliberately not read here — see
 * {@link getAnalysisResults}. This is a single indexed row and three batched
 * reads, so it answers in about the time a list row does however large the
 * analysis is.
 */
export async function getAnalysis(
	db: Db,
	analysisId: number,
): Promise<Analysis> {
	const [row] = await db
		.select({
			...minimalColumns,
			indexVersion: indexes.version,
			referenceName: legacyReferences.name,
			sampleName: legacySamples.name,
			userHandle: users.handle,
		})
		.from(analyses)
		.leftJoin(indexes, eq(indexes.id, analyses.index_id))
		.leftJoin(legacyReferences, eq(legacyReferences.id, analyses.reference_id))
		.leftJoin(legacySamples, eq(legacySamples.id, analyses.sample_id))
		.leftJoin(users, eq(users.id, analyses.user_id))
		.where(eq(analyses.id, analysisId))
		.limit(1);

	if (!row) {
		throw new AnalysisNotFoundError();
	}

	const [subtractionsByAnalysis, jobsById, files] = await Promise.all([
		getSubtractionsByAnalysis(db, [analysisId]),
		getAnalysisJobs(db, row.job_id != null ? [row.job_id] : []),
		getAnalysisFiles(db, analysisId),
	]);

	const minimal = mapMinimal(
		row,
		subtractionsByAnalysis.get(analysisId) ?? [],
		row.job_id != null ? (jobsById.get(row.job_id) ?? null) : null,
	);

	return { ...minimal, files };
}

/**
 * An analysis's results, shaped for presentation.
 *
 * Split from {@link getAnalysis} because this is the expensive half by a wide
 * margin: it reads the TOASTed `results` column — the largest thing in the row —
 * and then walks the whole blob, patching every OTU the analysis hit back to the
 * version it saw. Fetching it separately is what lets the viewer's header and
 * its in-progress state render without waiting for any of that.
 */
export async function getAnalysisResults(
	db: Db,
	analysisId: number,
): Promise<JsonObject | null> {
	const [row] = await db
		.select({
			ready: analyses.ready,
			results: analyses.results,
			workflow: analyses.workflow,
		})
		.from(analyses)
		.where(eq(analyses.id, analysisId))
		.limit(1);

	if (!row) {
		throw new AnalysisNotFoundError();
	}

	// Only a finished analysis is shaped. An unfinished one holds whatever it
	// holds — normally null, and never formatted — as Python does.
	if (!row.ready || !row.results) {
		return (row.results ?? null) as JsonObject | null;
	}

	let results = await formatAnalysis(db, row.workflow, row.results);

	if (row.workflow === "nuvs") {
		results = await attachBlasts(db, analysisId, results);
	}

	// Built from a JSONB column by pure object rebuilding, so it is JSON by
	// construction — the assertion is what lets it cross the RPC boundary.
	return results as JsonObject;
}

// BLAST records live in their own table, keyed to the contig they were requested
// for, and are merged onto the matching hit.
async function attachBlasts(
	db: DbOrTx,
	analysisId: number,
	results: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const hits = results.hits;

	if (!Array.isArray(hits)) {
		return results;
	}

	const rows = await db
		.select()
		.from(nuvsBlast)
		.where(eq(nuvsBlast.analysis_id, analysisId));

	const bySequenceIndex = new Map(
		rows.map((row) => [row.sequence_index, mapBlast(row)]),
	);

	return {
		...results,
		hits: hits.map((hit) => {
			if (typeof hit !== "object" || hit === null) {
				return hit;
			}

			const index = (hit as { index?: unknown }).index;

			return {
				...hit,
				blast:
					typeof index === "number"
						? (bySequenceIndex.get(index) ?? null)
						: null,
			};
		}),
	};
}

function mapBlast(row: typeof nuvsBlast.$inferSelect): NuvsBlast {
	return {
		id: row.id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		lastCheckedAt: row.last_checked_at,
		error: row.error,
		interval: row.interval,
		ready: row.ready,
		rid: row.rid,
		// Read straight out of a JSON column, so it is JSON by construction.
		result: (row.result ?? null) as JsonObject | null,
		sequenceIndex: row.sequence_index,
	};
}

/** The `legacy_samples` rights columns for the sample an analysis belongs to. */
export async function getAnalysisSampleRights(
	db: Db,
	analysisId: number,
): Promise<{
	all_read: boolean;
	all_write: boolean;
	group_read: boolean;
	group_write: boolean;
	group_id: number | null;
	user_id: number | null;
} | null> {
	const [row] = await db
		.select({
			all_read: legacySamples.all_read,
			all_write: legacySamples.all_write,
			group_read: legacySamples.group_read,
			group_write: legacySamples.group_write,
			group_id: legacySamples.group_id,
			user_id: legacySamples.user_id,
		})
		.from(analyses)
		.innerJoin(legacySamples, eq(legacySamples.id, analyses.sample_id))
		.where(eq(analyses.id, analysisId))
		.limit(1);

	return row ?? null;
}

export async function createAnalysis(
	db: Db,
	values: CreateAnalysisValues,
): Promise<Analysis> {
	const createdAt = new Date();

	const { analysisId, jobId } = await db.transaction(async (tx) => {
		const [sample] = await tx
			.select({ id: legacySamples.id, legacy_id: legacySamples.legacy_id })
			.from(legacySamples)
			.where(eq(legacySamples.id, values.sampleId))
			.limit(1);

		if (!sample) {
			throw new AnalysisRelationNotFoundError("Sample does not exist");
		}

		const [reference] = await tx
			.select({ id: legacyReferences.id, archived: legacyReferences.archived })
			.from(legacyReferences)
			.where(eq(legacyReferences.id, values.referenceId))
			.limit(1);

		if (!reference) {
			throw new AnalysisRelationNotFoundError("Reference does not exist");
		}

		if (reference.archived) {
			throw new AnalysisReferenceArchivedError("Reference is archived");
		}

		// The reference's current build is its highest-versioned ready index.
		const [index] = await tx
			.select({ id: indexes.id })
			.from(indexes)
			.where(
				and(eq(indexes.reference_id, reference.id), eq(indexes.ready, true)),
			)
			.orderBy(desc(indexes.version))
			.limit(1);

		if (!index) {
			throw new AnalysisNoReadyIndexError("No ready index for reference");
		}

		if (values.subtractionIds.length > 0) {
			const rows = await tx
				.select({ id: subtractions.id })
				.from(subtractions)
				.where(
					and(
						inArray(subtractions.id, values.subtractionIds),
						eq(subtractions.deleted, false),
					),
				);

			const found = new Set(rows.map((row) => row.id));
			const missing = values.subtractionIds.filter((id) => !found.has(id));

			if (missing.length > 0) {
				throw new AnalysisRelationNotFoundError(
					`Subtractions do not exist: ${[...missing].sort((a, b) => a - b).join(", ")}`,
				);
			}
		}

		// Create the job inside the analysis's transaction so the two commit
		// atomically: the job derives its `analysis_id` argument from
		// `analyses.job_id` on read, so a runner must not be able to claim it
		// before the analysis row exists.
		const jobId = await createJob(tx, values.workflow, values.userId);

		const analysis = takeFirstOrThrow(
			await tx
				.insert(analyses)
				.values({
					created_at: createdAt,
					updated_at: createdAt,
					workflow: values.workflow,
					ready: false,
					results: null,
					sample: sampleStorageId(sample.id, sample.legacy_id),
					sample_id: sample.id,
					reference_id: reference.id,
					index_id: index.id,
					user_id: values.userId,
					job_id: jobId,
				})
				.returning({ id: analyses.id }),
		);

		if (values.subtractionIds.length > 0) {
			await tx.insert(analysisSubtractions).values(
				values.subtractionIds.map((subtractionId) => ({
					analysis_id: analysis.id,
					subtraction_id: subtractionId,
				})),
			);
		}

		return { analysisId: analysis.id, jobId };
	});

	await emit("jobs", jobId, "create");
	await emit("analyses", analysisId, "create");
	// The sample's workflow tags are derived from its analyses, so the sample it
	// was started on now renders differently.
	await emit("samples", values.sampleId, "update");

	return getAnalysis(db, analysisId);
}

/**
 * Record an analysis's results and the files a workflow retained, and flip it
 * ready.
 *
 * The update is conditional on `ready = false` and its row count checked, so a
 * retry or a racing second call is an {@link AnalysisAlreadyFinalizedError}
 * rather than a duplicated file set. An analysis that does not exist is an
 * {@link AnalysisNotFoundError}.
 *
 * `name_on_disk` is unique across the table and is minted here rather than sent:
 * a uuid prefix, following the `createUpload` precedent, instead of Python's
 * post-flush `{id}-{name}`, which needs the row id and so a second write.
 *
 * The sample update is emitted alongside the analysis one because a sample's
 * workflow tags are derived from its analyses — an analysis flipping ready
 * changes the row every sample list draws.
 */
export async function finalizeAnalysis(
	db: Db,
	analysisId: number,
	values: FinalizeAnalysisValues,
): Promise<Analysis> {
	const sampleId = await db.transaction(async (tx) => {
		const now = new Date();

		const [updated] = await tx
			.update(analyses)
			.set({ ready: true, results: values.results, updated_at: now })
			.where(and(eq(analyses.id, analysisId), eq(analyses.ready, false)))
			.returning({ sampleId: analyses.sample_id });

		if (!updated) {
			const [row] = await tx
				.select({ id: analyses.id })
				.from(analyses)
				.where(eq(analyses.id, analysisId))
				.limit(1);

			if (!row) {
				throw new AnalysisNotFoundError();
			}

			throw new AnalysisAlreadyFinalizedError();
		}

		if (values.files.length > 0) {
			await tx.insert(analysisFiles).values(
				values.files.map((file) => ({
					analysis_id: analysisId,
					description: file.description,
					format: file.format,
					name: file.name,
					name_on_disk: `${crypto.randomUUID()}-${file.name}`,
					size: file.size,
					storage_key: file.storageKey,
					uploaded_at: now,
				})),
			);
		}

		return updated.sampleId;
	});

	await emit("analyses", analysisId, "update");

	if (sampleId !== null) {
		await emit("samples", sampleId, "update");
	}

	return getAnalysis(db, analysisId);
}

export async function deleteAnalysis(
	db: Db,
	storage: StorageBackend,
	logger: Logger,
	analysisId: number,
): Promise<Analysis> {
	const [row] = await db
		.select({
			id: analyses.id,
			sample_id: analyses.sample_id,
			jobState: jobs.state,
		})
		.from(analyses)
		.leftJoin(jobs, eq(jobs.id, analyses.job_id))
		.where(eq(analyses.id, analysisId))
		.limit(1);

	if (!row) {
		throw new AnalysisNotFoundError();
	}

	// The guard asks whether a job is actually working on this analysis, not
	// whether the analysis finished. `ready` cannot tell "still running" from
	// "failed and never will be": a workflow pod that is OOM-killed or evicted
	// leaves the row unready forever, and refusing on `ready` alone made that
	// analysis undeletable by anyone. A job that reached a terminal state, or an
	// analysis with no job row at all, cannot be in flight.
	if (row.jobState !== null && !isJobStateTerminal(row.jobState)) {
		throw new AnalysisRunningError("Analysis is still running");
	}

	// Capture the full analysis for the return value before its rows are removed.
	const analysis = await getAnalysis(db, analysisId);

	// Read before the delete: `analysis_files` cascades on `analyses.id`.
	const fileRows = await db
		.select({ key: analysisFiles.storage_key })
		.from(analysisFiles)
		.where(eq(analysisFiles.analysis_id, analysisId));

	const deleted = await db
		.delete(analyses)
		.where(eq(analyses.id, analysisId))
		.returning({ id: analyses.id });

	if (deleted.length === 0) {
		throw new AnalysisNotFoundError();
	}

	// Only objects a row named are removed. A migrated analysis's result blobs
	// have no row and are left for the orphan sweep.
	const storageKeys = fileRows
		.map(({ key }) => key)
		.filter((key) => key !== null);

	for (const failure of await deleteKeys(storage, storageKeys)) {
		logger.error(
			{ analysisId, key: failure.key, err: failure.error },
			"storage cleanup failed; file orphaned",
		);
	}

	await emit("analyses", analysisId, "delete");

	if (row.sample_id !== null) {
		await emit("samples", row.sample_id, "update");
	}

	return analysis;
}

export async function blastNuvs(
	db: Db,
	analysisId: number,
	sequenceIndex: number,
): Promise<NuvsBlast> {
	const timestamp = new Date();

	const [row] = await db
		.select({
			id: analyses.id,
			workflow: analyses.workflow,
			ready: analyses.ready,
			results: analyses.results,
		})
		.from(analyses)
		.where(eq(analyses.id, analysisId))
		.limit(1);

	if (!row) {
		throw new AnalysisNotFoundError();
	}

	if (row.workflow !== "nuvs") {
		throw new AnalysisNotNuvsError("Not a NuVs analysis");
	}

	if (!row.ready) {
		throw new AnalysisRunningError("Analysis is still running");
	}

	if (findNuvsSequenceByIndex(row.results, sequenceIndex) === null) {
		throw new AnalysisSequenceNotFoundError("Sequence not found");
	}

	const blast = await db.transaction(async (tx) => {
		// Requesting a BLAST for a contig that already has one replaces it, rather
		// than colliding on the (analysis, sequence) unique constraint.
		await tx
			.delete(nuvsBlast)
			.where(
				and(
					eq(nuvsBlast.analysis_id, analysisId),
					eq(nuvsBlast.sequence_index, sequenceIndex),
				),
			);

		const inserted = takeFirstOrThrow(
			await tx
				.insert(nuvsBlast)
				.values({
					analysis_id: analysisId,
					created_at: timestamp,
					last_checked_at: timestamp,
					ready: false,
					sequence_index: sequenceIndex,
					updated_at: timestamp,
					interval: 3,
				})
				.returning(),
		);

		await tx
			.update(analyses)
			.set({ updated_at: timestamp })
			.where(eq(analyses.id, analysisId));

		return inserted;
	});

	await emit("analyses", analysisId, "update");

	return mapBlast(blast);
}

/**
 * The contig at `sequenceIndex` in a NuVs results blob, or `null` when there is
 * none.
 */
export function findNuvsSequenceByIndex(
	results: Record<string, unknown> | null,
	sequenceIndex: number,
): string | null {
	if (!results || !Array.isArray(results.hits)) {
		return null;
	}

	const matches = results.hits.filter(
		(hit) =>
			typeof hit === "object" &&
			hit !== null &&
			(hit as { index?: unknown }).index === sequenceIndex,
	);

	if (matches.length === 0) {
		return null;
	}

	// Two contigs sharing an index should be impossible. If it happens, the blob
	// is corrupt and picking one arbitrarily would BLAST the wrong sequence.
	if (matches.length > 1) {
		throw new AppError(`More than one sequence with index ${sequenceIndex}`);
	}

	return String((matches[0] as { sequence?: unknown }).sequence ?? "");
}

/** The workflow and raw results of an analysis, for the document export. */
export async function getAnalysisForExport(
	db: Db,
	analysisId: number,
): Promise<{
	workflow: string;
	results: JsonObject | null;
	sample: string;
}> {
	const [row] = await db
		.select({
			workflow: analyses.workflow,
			results: analyses.results,
			sample: analyses.sample,
		})
		.from(analyses)
		.where(eq(analyses.id, analysisId))
		.limit(1);

	if (!row) {
		throw new AnalysisNotFoundError();
	}

	// Read straight out of a JSONB column, so it is JSON by construction.
	return { ...row, results: (row.results ?? null) as JsonObject | null };
}
