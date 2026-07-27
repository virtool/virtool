import type {
	JobState,
	LabelNested,
	LibraryType,
	Quality,
	Read,
	Sample,
	SampleArtifact,
	SampleCreateRequest,
	SampleJobNested,
	SampleMinimal,
	SampleRightsUpdate,
	SampleSearchResult,
	SampleUpdateRequest,
	SampleWorkflows,
	SubtractionNested,
	UserNested,
	WorkflowState,
} from "@virtool/contracts";
import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	ilike,
	inArray,
	not,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { analyses } from "../db/schema/analyses";
import { groups, userGroups } from "../db/schema/groups";
import { labels } from "../db/schema/labels";
import {
	type LegacySampleRow,
	legacySampleLabels,
	legacySampleSubtractions,
	legacySamples,
	sampleArtifacts,
	sampleReads,
	sampleUploads,
} from "../db/schema/samples";
import { subtractions } from "../db/schema/subtractions";
import { uploads } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { createJob, getJobs } from "../jobs/data";
import { logger } from "../logger";
import { getSettings } from "../settings/data";
import {
	deletePrefix,
	type StorageBackend,
	samplePrefix,
	sampleStorageId,
} from "../storage";
import { reserveUploads } from "../uploads/data";

/** A read or write right on a sample. */
export type SampleRight = "read" | "write";

/** The caller resolved to the identity used for per-sample authorization. */
export type SampleActor = {
	userId: number;
	groupIds: number[];
	isAdmin: boolean;
};

/** Filters and pagination accepted by {@link findSamples}. */
export type FindSamplesOptions = {
	page: number;
	perPage: number;
	term: string;
	labels: number[];
	users: number[];
	workflows: string[];
};

/**
 * The fields a sample is created from, plus the creating user. The handler
 * coerces the request's `group` (id, legacy string, or null) to an id or null
 * before it reaches here.
 */
export type CreateSampleValues = Omit<SampleCreateRequest, "group"> & {
	group: number | null;
	userId: number;
};

/** The fields that can be changed when updating a sample. */
export type UpdateSampleValues = SampleUpdateRequest;

/** Thrown when a requested sample does not exist. */
export class SampleNotFoundError extends AppError {}

/** Thrown when a sample name is already taken. */
export class SampleNameConflictError extends AppError {}

/** Thrown when a create or update references a label that does not exist. */
export class SampleLabelsNotFoundError extends AppError {}

/** Thrown when a create or update references a subtraction that does not exist. */
export class SampleSubtractionsNotFoundError extends AppError {}

/** Thrown when a rights or create request names a group that does not exist. */
export class SampleGroupNotFoundError extends AppError {}

/** Thrown when the `force_choice` policy requires a group and none was given. */
export class SampleGroupRequiredError extends AppError {}

/** Thrown when the same upload is supplied more than once to create a sample. */
export class SampleFileDuplicateError extends AppError {}

/**
 * Thrown when a sample has no owner. `user_id` is nullable in the schema, but a
 * sample without a creating user is a data-integrity violation, not a routine
 * outcome — reading one surfaces it rather than degrading to a blank owner.
 */
export class SampleOwnerlessError extends AppError {}

const WORKFLOW_NAMES = ["nuvs", "pathoscope"] as const;
const WORKFLOW_CONDITIONS = ["none", "pending", "ready"] as const;

type WorkflowName = (typeof WORKFLOW_NAMES)[number];

/** A sample's derived workflow tags, keyed as the client consumes them. */
type WorkflowTags = {
	nuvs: boolean | string;
	pathoscope: boolean | string;
	workflows: SampleWorkflows;
};

// Escape LIKE wildcards so a user's `%` or `_` matches literally.
function escapeLike(term: string): string {
	return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// `None` (no analyses) is a `false` tag, a ready analysis is `true`, and an
// unfinished analysis is `"ip"` — the legacy top-level tag encoding.
function encodeTag(ready: boolean | undefined): boolean | string {
	if (ready === undefined) {
		return false;
	}
	return ready ? true : "ip";
}

function encodeWorkflows(readyByWorkflow: Map<string, boolean>): WorkflowTags {
	const workflows: SampleWorkflows = { nuvs: "none", pathoscope: "none" };

	for (const name of WORKFLOW_NAMES) {
		const ready = readyByWorkflow.get(name);
		if (ready !== undefined) {
			workflows[name] = ready ? "complete" : ("pending" as WorkflowState);
		}
	}

	return {
		nuvs: encodeTag(readyByWorkflow.get("nuvs")),
		pathoscope: encodeTag(readyByWorkflow.get("pathoscope")),
		workflows,
	};
}

const EMPTY_TAGS: WorkflowTags = encodeWorkflows(new Map());

// One `GROUP BY workflow, bool_or(ready)` query bounded to the page's sample
// ids, so the aggregation never scans the whole analyses table.
async function getWorkflowTagsBySample(
	db: DbOrTx,
	sampleIds: number[],
): Promise<Map<number, WorkflowTags>> {
	if (sampleIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			sampleId: analyses.sample_id,
			workflow: analyses.workflow,
			ready: sql<boolean>`bool_or(${analyses.ready})`,
		})
		.from(analyses)
		.where(inArray(analyses.sample_id, sampleIds))
		.groupBy(analyses.sample_id, analyses.workflow);

	const readyBySample = new Map<number, Map<string, boolean>>();

	for (const row of rows) {
		if (row.sampleId == null) {
			continue;
		}
		const forSample = readyBySample.get(row.sampleId) ?? new Map();
		forSample.set(row.workflow, row.ready);
		readyBySample.set(row.sampleId, forSample);
	}

	return new Map(
		sampleIds.map((id) => [
			id,
			encodeWorkflows(readyBySample.get(id) ?? new Map()),
		]),
	);
}

async function getLabelsBySample(
	db: DbOrTx,
	sampleIds: number[],
): Promise<Map<number, LabelNested[]>> {
	if (sampleIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			sampleId: legacySampleLabels.sample_id,
			id: labels.id,
			name: labels.name,
			color: labels.color,
			description: labels.description,
		})
		.from(legacySampleLabels)
		.innerJoin(labels, eq(labels.id, legacySampleLabels.label_id))
		.where(inArray(legacySampleLabels.sample_id, sampleIds))
		.orderBy(asc(legacySampleLabels.label_id));

	const bySample = new Map<number, LabelNested[]>();

	for (const row of rows) {
		const list = bySample.get(row.sampleId) ?? [];
		list.push({
			id: row.id,
			name: row.name ?? "",
			color: row.color ?? "",
			description: row.description ?? "",
		});
		bySample.set(row.sampleId, list);
	}

	return bySample;
}

// The sample's creation job, reduced to the embedded shape. Reuses the jobs
// data layer so a sample's job never disagrees with the jobs endpoints.
async function getSampleJobs(
	db: Db,
	jobIds: number[],
): Promise<Map<number, SampleJobNested>> {
	const jobs = await getJobs(db, jobIds);

	return new Map(
		jobs.map((job) => [
			job.id,
			{
				createdAt: job.created_at.toISOString(),
				id: job.id,
				progress: job.progress,
				// The mirror stores states and workflows as free text; the columns
				// only ever hold the enumerated values, and a sample's job is always
				// the `create_sample` job that built it.
				state: job.state as JobState,
				user: job.user,
				workflow: job.workflow as "create_sample",
			},
		]),
	);
}

async function getSubtractionsBySample(
	db: DbOrTx,
	sampleId: number,
): Promise<SubtractionNested[]> {
	return db
		.select({ id: subtractions.id, name: subtractions.name })
		.from(legacySampleSubtractions)
		.innerJoin(
			subtractions,
			eq(subtractions.id, legacySampleSubtractions.subtraction_id),
		)
		.where(eq(legacySampleSubtractions.sample_id, sampleId))
		.orderBy(asc(legacySampleSubtractions.subtraction_id));
}

async function getArtifacts(
	db: DbOrTx,
	sampleId: number,
	storageId: string,
): Promise<SampleArtifact[]> {
	const rows = await db
		.select()
		.from(sampleArtifacts)
		.where(
			or(
				eq(sampleArtifacts.sample_id, sampleId),
				eq(sampleArtifacts.sample, storageId),
			),
		)
		.orderBy(asc(sampleArtifacts.id));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		size: row.size ?? 0,
		downloadUrl: `/samples/${sampleId}/artifacts/${row.name_on_disk ?? ""}`,
	}));
}

async function getReads(
	db: DbOrTx,
	sampleId: number,
	storageId: string,
): Promise<Read[]> {
	const rows = await db
		.select({
			read: sampleReads,
			upload: uploads,
			uploadUser: { id: users.id, handle: users.handle },
		})
		.from(sampleReads)
		.leftJoin(uploads, eq(uploads.id, sampleReads.upload))
		.leftJoin(users, eq(users.id, uploads.userId))
		.where(
			or(
				eq(sampleReads.sample_id, sampleId),
				eq(sampleReads.sample, storageId),
			),
		)
		.orderBy(asc(sampleReads.id));

	return rows.map(({ read, upload, uploadUser }) => ({
		downloadUrl: `/samples/${sampleId}/reads/${read.name}`,
		id: read.id,
		name: read.name,
		nameOnDisk: read.name_on_disk,
		sample: sampleId,
		size: read.size ?? 0,
		upload:
			upload == null
				? null
				: {
						id: upload.id,
						name: upload.name ?? "",
						size: upload.size,
						uploadedAt: upload.uploadedAt?.toISOString() ?? null,
						user: uploadUser?.id != null ? uploadUser : null,
					},
		uploadedAt: read.uploaded_at?.toISOString() ?? "",
	}));
}

function mapMinimal(
	row: LegacySampleRow,
	sampleLabels: LabelNested[],
	tags: WorkflowTags,
	job: SampleJobNested | undefined,
	user: UserNested,
): SampleMinimal {
	return {
		createdAt: row.created_at.toISOString(),
		host: row.host,
		id: row.id,
		isolate: row.isolate,
		job,
		labels: sampleLabels,
		libraryType: row.library_type as LibraryType,
		name: row.name,
		notes: row.notes,
		nuvs: tags.nuvs,
		pathoscope: tags.pathoscope,
		ready: row.ready,
		user,
		workflows: tags.workflows,
	};
}

// The sample's owner, resolved from the joined `users` row. `user_id` is nullable
// in the schema; an ownerless sample maps to the sentinel owner.
function resolveOwner(
	userId: number | null,
	handle: string | null,
): UserNested {
	if (userId == null) {
		return { id: 0, handle: "" };
	}

	return { id: userId, handle: handle ?? "" };
}

/** Resolve a user id to the identity used for per-sample authorization. */
export async function resolveSampleActor(
	db: Db,
	userId: number,
): Promise<SampleActor> {
	const [userRows, groupRows] = await Promise.all([
		db
			.select({ role: users.administratorRole })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1),
		db
			.select({ groupId: userGroups.groupId })
			.from(userGroups)
			.where(eq(userGroups.userId, userId)),
	]);

	return {
		userId,
		groupIds: groupRows.map((row) => row.groupId),
		isAdmin: userRows[0]?.role === "full",
	};
}

/** The `legacy_samples` columns {@link hasSampleRight} needs to resolve a right. */
type SampleRightsRow = {
	all_read: boolean;
	all_write: boolean;
	group_read: boolean;
	group_write: boolean;
	group_id: number | null;
	user_id: number | null;
};

/**
 * Whether `actor` holds `right` on a sample row. Shared by the samples and
 * analyses domains so a sample and the analyses on it never disagree about who
 * may read or write them.
 *
 * A full administrator and the sample's owner always hold every right;
 * otherwise `all_read`/`all_write` grant everyone and `group_read`/`group_write`
 * grant only members of the sample's group.
 */
export function hasSampleRight(
	row: SampleRightsRow,
	actor: SampleActor,
	right: SampleRight,
): boolean {
	if (actor.isAdmin || row.user_id === actor.userId) {
		return true;
	}

	const isGroupMember =
		row.group_id != null && actor.groupIds.includes(row.group_id);

	if (right === "read") {
		return row.all_read || (isGroupMember && row.group_read);
	}

	return row.all_write || (isGroupMember && row.group_write);
}

/**
 * The Postgres predicate scoping a list to the samples `actor` may read — the
 * WHERE-clause form of {@link hasSampleRight}. A full administrator sees every
 * sample. Returns `undefined` for an administrator so callers can omit the
 * clause entirely.
 */
export function sampleReadableFilter(actor: SampleActor): SQL | undefined {
	if (actor.isAdmin) {
		return undefined;
	}

	const clauses = [
		eq(legacySamples.all_read, true),
		eq(legacySamples.user_id, actor.userId),
	];

	if (actor.groupIds.length > 0) {
		clauses.push(
			and(
				eq(legacySamples.group_read, true),
				inArray(legacySamples.group_id, actor.groupIds),
			) as SQL,
		);
	}

	return or(...clauses);
}

// A correlated EXISTS on analyses for the enclosing sample row, optionally
// restricted to a ready state.
function existsAnalysis(db: Db, workflow: string, ready?: boolean): SQL {
	const conditions = [
		eq(analyses.sample_id, legacySamples.id),
		eq(analyses.workflow, workflow),
	];

	if (ready !== undefined) {
		conditions.push(eq(analyses.ready, ready));
	}

	return exists(
		db
			.select({ one: sql`1` })
			.from(analyses)
			.where(and(...conditions)),
	);
}

function composeWorkflowConditionFilter(
	db: Db,
	workflow: string,
	condition: string,
): SQL {
	if (condition === "ready") {
		return existsAnalysis(db, workflow, true);
	}

	if (condition === "pending") {
		return and(
			existsAnalysis(db, workflow),
			not(existsAnalysis(db, workflow, true)),
		) as SQL;
	}

	return not(existsAnalysis(db, workflow));
}

// Each `workflow:condition` pair becomes a correlated semi-join on analyses.
// Conditions for one workflow are ORed, different workflows ANDed. Pairs with an
// unknown workflow or condition are dropped, matching the old Mongo query.
function composeWorkflowFilter(db: Db, workflows: string[]): SQL | undefined {
	const conditionsByWorkflow = new Map<WorkflowName, Set<string>>();

	for (const value of workflows) {
		for (const pair of value.split(" ")) {
			const [workflow, condition] = pair.split(":");

			if (
				workflow !== undefined &&
				condition !== undefined &&
				(WORKFLOW_NAMES as readonly string[]).includes(workflow) &&
				(WORKFLOW_CONDITIONS as readonly string[]).includes(condition)
			) {
				const key = workflow as WorkflowName;
				const set = conditionsByWorkflow.get(key) ?? new Set();
				set.add(condition);
				conditionsByWorkflow.set(key, set);
			}
		}
	}

	if (conditionsByWorkflow.size === 0) {
		return undefined;
	}

	const clauses = [...conditionsByWorkflow].map(
		([workflow, conditions]) =>
			or(
				...[...conditions].map((condition) =>
					composeWorkflowConditionFilter(db, workflow, condition),
				),
			) as SQL,
	);

	return and(...clauses);
}

export async function findSamples(
	db: Db,
	options: FindSamplesOptions,
	actor: SampleActor,
): Promise<SampleSearchResult> {
	const filters: SQL[] = [];

	const readable = sampleReadableFilter(actor);
	if (readable) {
		filters.push(readable);
	}

	if (options.term) {
		filters.push(ilike(legacySamples.name, `%${escapeLike(options.term)}%`));
	}

	if (options.users.length > 0) {
		filters.push(inArray(legacySamples.user_id, options.users));
	}

	if (options.labels.length > 0) {
		filters.push(
			inArray(
				legacySamples.id,
				db
					.select({ id: legacySampleLabels.sample_id })
					.from(legacySampleLabels)
					.where(inArray(legacySampleLabels.label_id, options.labels)),
			),
		);
	}

	const workflowFilter = composeWorkflowFilter(db, options.workflows);
	if (workflowFilter) {
		filters.push(workflowFilter);
	}

	const where = filters.length > 0 ? and(...filters) : undefined;

	const [totalRows, foundRows, rows] = await Promise.all([
		// Python's `total_count` is the unscoped grand total of samples, not the
		// count visible to the caller. Match it exactly.
		db.select({ value: count() }).from(legacySamples),
		db.select({ value: count() }).from(legacySamples).where(where),
		// The owner joins onto the sample row; the collection relationships fan
		// out below, batched by the page's sample ids.
		db
			.select({ sample: legacySamples, ownerHandle: users.handle })
			.from(legacySamples)
			.leftJoin(users, eq(users.id, legacySamples.user_id))
			.where(where)
			.orderBy(desc(legacySamples.created_at), asc(legacySamples.id))
			.offset((options.page - 1) * options.perPage)
			.limit(options.perPage),
	]);

	const totalCount = totalRows[0]?.value ?? 0;
	const foundCount = foundRows[0]?.value ?? 0;

	const sampleIds = rows.map(({ sample }) => sample.id);
	const jobIds = [
		...new Set(
			rows
				.map(({ sample }) => sample.job_id)
				.filter((id): id is number => id != null),
		),
	];

	const [labelsBySample, tagsBySample, jobsById] = await Promise.all([
		getLabelsBySample(db, sampleIds),
		getWorkflowTagsBySample(db, sampleIds),
		getSampleJobs(db, jobIds),
	]);

	return {
		foundCount,
		totalCount,
		page: options.page,
		perPage: options.perPage,
		pageCount: foundCount ? Math.ceil(foundCount / options.perPage) : 0,
		items: rows.map(({ sample, ownerHandle }) =>
			mapMinimal(
				sample,
				labelsBySample.get(sample.id) ?? [],
				tagsBySample.get(sample.id) ?? EMPTY_TAGS,
				sample.job_id != null
					? (jobsById.get(sample.job_id) ?? undefined)
					: undefined,
				resolveOwner(sample.user_id, ownerHandle),
			),
		),
	};
}

export async function getSample(db: Db, sampleId: number): Promise<Sample> {
	// The owner and group are one-to-one, so they join onto the sample row; the
	// collection relationships (labels, subtractions, reads, artifacts, analyses)
	// are separate result sets that fan out below.
	const [row] = await db
		.select({
			sample: legacySamples,
			ownerHandle: users.handle,
			group: { id: groups.id, name: groups.name, legacy_id: groups.legacyId },
		})
		.from(legacySamples)
		.leftJoin(users, eq(users.id, legacySamples.user_id))
		.leftJoin(groups, eq(groups.id, legacySamples.group_id))
		.where(eq(legacySamples.id, sampleId))
		.limit(1);

	if (!row) {
		throw new SampleNotFoundError();
	}

	const { sample, ownerHandle, group: groupRow } = row;

	if (sample.user_id == null) {
		throw new SampleOwnerlessError();
	}

	const jobIds = sample.job_id != null ? [sample.job_id] : [];
	const storageId = sampleStorageId(sampleId, sample.legacy_id);

	const [
		labelsBySample,
		tagsBySample,
		jobsById,
		sampleSubtractions,
		artifacts,
		reads,
	] = await Promise.all([
		getLabelsBySample(db, [sampleId]),
		getWorkflowTagsBySample(db, [sampleId]),
		getSampleJobs(db, jobIds),
		getSubtractionsBySample(db, sampleId),
		getArtifacts(db, sampleId, storageId),
		getReads(db, sampleId, storageId),
	]);

	const minimal = mapMinimal(
		sample,
		labelsBySample.get(sampleId) ?? [],
		tagsBySample.get(sampleId) ?? EMPTY_TAGS,
		sample.job_id != null
			? (jobsById.get(sample.job_id) ?? undefined)
			: undefined,
		resolveOwner(sample.user_id, ownerHandle),
	);

	return {
		...minimal,
		allRead: sample.all_read,
		allWrite: sample.all_write,
		artifacts,
		format: sample.format,
		group: groupRow,
		groupRead: sample.group_read,
		groupWrite: sample.group_write,
		hold: sample.hold,
		isLegacy: sample.is_legacy,
		locale: sample.locale,
		paired: reads.length === 2,
		quality: (sample.quality as Quality | null) ?? null,
		reads,
		subtractions: sampleSubtractions,
	};
}

/**
 * The owner user id of a sample, or `null` when the sample does not exist — the
 * rights-mutation gate treats that as "not found". A sample that exists but has
 * no owner is an invalid state and throws {@link SampleOwnerlessError}.
 */
export async function getSampleOwnerId(
	db: Db,
	sampleId: number,
): Promise<number | null> {
	const [row] = await db
		.select({ userId: legacySamples.user_id })
		.from(legacySamples)
		.where(eq(legacySamples.id, sampleId))
		.limit(1);

	if (!row) {
		return null;
	}

	if (row.userId == null) {
		throw new SampleOwnerlessError();
	}

	return row.userId;
}

/**
 * Whether `actor` holds `right` on the sample, resolving the row first.
 *
 * A lookup for a nonexistent sample returns `true`, so the caller's subsequent
 * fetch produces the 404 rather than this returning a misleading 403.
 */
export async function checkSampleRight(
	db: Db,
	sampleId: number,
	actor: SampleActor,
	right: SampleRight,
): Promise<boolean> {
	const [row] = await db
		.select({
			all_read: legacySamples.all_read,
			all_write: legacySamples.all_write,
			group_read: legacySamples.group_read,
			group_write: legacySamples.group_write,
			group_id: legacySamples.group_id,
			user_id: legacySamples.user_id,
		})
		.from(legacySamples)
		.where(eq(legacySamples.id, sampleId))
		.limit(1);

	if (!row) {
		return true;
	}

	return hasSampleRight(row, actor, right);
}

async function checkNameInUse(
	db: DbOrTx,
	name: string,
	excludeId?: number,
): Promise<void> {
	const [row] = await db
		.select({ id: legacySamples.id })
		.from(legacySamples)
		.where(
			excludeId === undefined
				? eq(legacySamples.name, name)
				: and(
						eq(legacySamples.name, name),
						not(eq(legacySamples.id, excludeId)),
					),
		)
		.limit(1);

	if (row) {
		throw new SampleNameConflictError("Sample name is already in use");
	}
}

async function checkLabelsExist(db: DbOrTx, labelIds: number[]): Promise<void> {
	if (labelIds.length === 0) {
		return;
	}

	const rows = await db
		.select({ id: labels.id })
		.from(labels)
		.where(inArray(labels.id, labelIds));

	const found = new Set(rows.map((row) => row.id));
	const missing = labelIds.filter((id) => !found.has(id));

	if (missing.length > 0) {
		throw new SampleLabelsNotFoundError(
			`Labels do not exist: ${missing.join(", ")}`,
		);
	}
}

async function checkSubtractionsExist(
	db: DbOrTx,
	subtractionIds: number[],
): Promise<void> {
	if (subtractionIds.length === 0) {
		return;
	}

	const rows = await db
		.select({ id: subtractions.id })
		.from(subtractions)
		.where(inArray(subtractions.id, subtractionIds));

	const found = new Set(rows.map((row) => row.id));
	const missing = subtractionIds.filter((id) => !found.has(id));

	if (missing.length > 0) {
		throw new SampleSubtractionsNotFoundError(
			`Subtractions do not exist: ${missing.join(",")}`,
		);
	}
}

async function resolveCreateGroup(
	db: Db,
	values: CreateSampleValues,
	sampleGroup: string,
): Promise<number | null> {
	if (sampleGroup === "force_choice") {
		if (values.group == null) {
			throw new SampleGroupRequiredError(
				"Group value required for sample creation",
			);
		}

		const [group] = await db
			.select({ id: groups.id })
			.from(groups)
			.where(eq(groups.id, values.group))
			.limit(1);

		if (!group) {
			throw new SampleGroupNotFoundError("Group does not exist");
		}

		return group.id;
	}

	if (sampleGroup === "users_primary_group") {
		const [row] = await db
			.select({ groupId: userGroups.groupId })
			.from(userGroups)
			.where(
				and(eq(userGroups.userId, values.userId), eq(userGroups.primary, true)),
			)
			.limit(1);

		return row?.groupId ?? null;
	}

	return null;
}

export async function createSample(
	db: Db,
	values: CreateSampleValues,
): Promise<Sample> {
	const settings = await getSettings(db);

	await Promise.all([
		checkNameInUse(db, values.name),
		checkLabelsExist(db, values.labels),
		checkSubtractionsExist(db, values.subtractions),
	]);

	if (new Set(values.files).size !== values.files.length) {
		throw new SampleFileDuplicateError("File is duplicated");
	}

	const groupId = await resolveCreateGroup(db, values, settings.sampleGroup);

	const { sampleId, jobId } = await db.transaction(async (tx) => {
		// Reserve uploads and create the job inside the sample's transaction so
		// everything commits atomically: a runner must not claim the job before
		// the sample row it derives its arguments from exists.
		await reserveUploads(tx, values.files);

		const jobId = await createJob(tx, "create_sample", values.userId);

		const sample = takeFirstOrThrow(
			await tx
				.insert(legacySamples)
				.values({
					all_read: settings.sampleAllRead,
					all_write: settings.sampleAllWrite,
					created_at: new Date(),
					format: "fastq",
					group_id: groupId,
					group_read: settings.sampleGroupRead,
					group_write: settings.sampleGroupWrite,
					hold: true,
					host: values.host,
					is_legacy: false,
					isolate: values.isolate,
					job_id: jobId,
					library_type: values.libraryType,
					locale: values.locale,
					name: values.name,
					notes: values.notes,
					paired: values.files.length === 2,
					quality: null,
					ready: false,
					user_id: values.userId,
				})
				.returning({ id: legacySamples.id }),
		);

		const sampleId = sample.id;

		if (values.labels.length > 0) {
			await tx.insert(legacySampleLabels).values(
				values.labels.map((labelId) => ({
					sample_id: sampleId,
					label_id: labelId,
				})),
			);
		}

		if (values.subtractions.length > 0) {
			await tx.insert(legacySampleSubtractions).values(
				values.subtractions.map((subtractionId) => ({
					sample_id: sampleId,
					subtraction_id: subtractionId,
				})),
			);
		}

		if (values.files.length > 0) {
			await tx.insert(sampleUploads).values(
				values.files.map((uploadId, index) => ({
					sample: String(sampleId),
					sample_id: sampleId,
					upload_id: uploadId,
					index,
				})),
			);
		}

		return { sampleId, jobId };
	});

	await emit("jobs", jobId, "create");
	await emit("samples", sampleId, "create");

	return getSample(db, sampleId);
}

export async function updateSample(
	db: Db,
	sampleId: number,
	values: UpdateSampleValues,
): Promise<Sample> {
	const [existing] = await db
		.select({ id: legacySamples.id })
		.from(legacySamples)
		.where(eq(legacySamples.id, sampleId))
		.limit(1);

	if (!existing) {
		throw new SampleNotFoundError();
	}

	const checks: Promise<void>[] = [];

	if (values.name !== undefined) {
		checks.push(checkNameInUse(db, values.name, sampleId));
	}
	if (values.labels !== undefined) {
		checks.push(checkLabelsExist(db, values.labels));
	}
	if (values.subtractions !== undefined) {
		checks.push(checkSubtractionsExist(db, values.subtractions));
	}

	await Promise.all(checks);

	const scalars: Partial<
		Pick<LegacySampleRow, "name" | "host" | "isolate" | "locale" | "notes">
	> = {};

	if (values.name !== undefined) {
		scalars.name = values.name;
	}
	if (values.host !== undefined) {
		scalars.host = values.host;
	}
	if (values.isolate !== undefined) {
		scalars.isolate = values.isolate;
	}
	if (values.locale !== undefined) {
		scalars.locale = values.locale;
	}
	if (values.notes !== undefined) {
		scalars.notes = values.notes;
	}

	await db.transaction(async (tx) => {
		if (Object.keys(scalars).length > 0) {
			await tx
				.update(legacySamples)
				.set(scalars)
				.where(eq(legacySamples.id, sampleId));
		}

		if (values.labels !== undefined) {
			await tx
				.delete(legacySampleLabels)
				.where(eq(legacySampleLabels.sample_id, sampleId));

			if (values.labels.length > 0) {
				await tx.insert(legacySampleLabels).values(
					values.labels.map((labelId) => ({
						sample_id: sampleId,
						label_id: labelId,
					})),
				);
			}
		}

		if (values.subtractions !== undefined) {
			await tx
				.delete(legacySampleSubtractions)
				.where(eq(legacySampleSubtractions.sample_id, sampleId));

			if (values.subtractions.length > 0) {
				await tx.insert(legacySampleSubtractions).values(
					values.subtractions.map((subtractionId) => ({
						sample_id: sampleId,
						subtraction_id: subtractionId,
					})),
				);
			}
		}
	});

	await emit("samples", sampleId, "update");

	return getSample(db, sampleId);
}

export async function updateSampleRights(
	db: Db,
	sampleId: number,
	data: SampleRightsUpdate,
): Promise<Sample> {
	const [existing] = await db
		.select({ id: legacySamples.id })
		.from(legacySamples)
		.where(eq(legacySamples.id, sampleId))
		.limit(1);

	if (!existing) {
		throw new SampleNotFoundError();
	}

	const scalars: Partial<
		Pick<
			LegacySampleRow,
			"all_read" | "all_write" | "group_read" | "group_write" | "group_id"
		>
	> = {};

	if (data.allRead !== undefined) {
		scalars.all_read = data.allRead;
	}
	if (data.allWrite !== undefined) {
		scalars.all_write = data.allWrite;
	}
	if (data.groupRead !== undefined) {
		scalars.group_read = data.groupRead;
	}
	if (data.groupWrite !== undefined) {
		scalars.group_write = data.groupWrite;
	}

	if ("group" in data) {
		let groupId: number | null = null;

		if (data.group != null && data.group !== "none") {
			const [group] = await db
				.select({ id: groups.id })
				.from(groups)
				.where(
					typeof data.group === "number"
						? eq(groups.id, data.group)
						: eq(groups.legacyId, data.group),
				)
				.limit(1);

			if (!group) {
				throw new SampleGroupNotFoundError("Group does not exist");
			}

			groupId = group.id;
		}

		scalars.group_id = groupId;
	}

	if (Object.keys(scalars).length > 0) {
		await db
			.update(legacySamples)
			.set(scalars)
			.where(eq(legacySamples.id, sampleId));
	}

	await emit("samples", sampleId, "update");

	return getSample(db, sampleId);
}

export async function deleteSample(
	db: Db,
	storage: StorageBackend,
	sampleId: number,
): Promise<Sample> {
	const [row] = await db
		.select({ id: legacySamples.id, legacy_id: legacySamples.legacy_id })
		.from(legacySamples)
		.where(eq(legacySamples.id, sampleId))
		.limit(1);

	if (!row) {
		throw new SampleNotFoundError();
	}

	// Capture the full sample for the return value before its rows are removed.
	const sample = await getSample(db, sampleId);

	const storageId = sampleStorageId(sampleId, row.legacy_id);

	const uploadRows = await db
		.select({ uploadId: sampleUploads.upload_id })
		.from(sampleUploads)
		.where(
			or(
				eq(sampleUploads.sample_id, sampleId),
				eq(sampleUploads.sample, storageId),
			),
		);
	const uploadIds = [...new Set(uploadRows.map((r) => r.uploadId))];

	// The FK cascade only covers two of these relationships, so every table is
	// deleted explicitly. Rows may be keyed by the integer id or the legacy
	// storage string depending on when the sample was created.
	await db.transaction(async (tx) => {
		if (uploadIds.length > 0) {
			await tx
				.update(uploads)
				.set({ reserved: false })
				.where(inArray(uploads.id, uploadIds));
		}

		await tx.delete(analyses).where(eq(analyses.sample_id, sampleId));
		await tx
			.delete(sampleUploads)
			.where(
				or(
					eq(sampleUploads.sample_id, sampleId),
					eq(sampleUploads.sample, storageId),
				),
			);
		await tx
			.delete(sampleArtifacts)
			.where(
				or(
					eq(sampleArtifacts.sample_id, sampleId),
					eq(sampleArtifacts.sample, storageId),
				),
			);
		await tx
			.delete(sampleReads)
			.where(
				or(
					eq(sampleReads.sample_id, sampleId),
					eq(sampleReads.sample, storageId),
				),
			);

		const deleted = await tx
			.delete(legacySamples)
			.where(eq(legacySamples.id, sampleId))
			.returning({ id: legacySamples.id });

		if (deleted.length === 0) {
			throw new SampleNotFoundError();
		}
	});

	for (const failure of await deletePrefix(storage, samplePrefix(storageId))) {
		logger.error(
			{ sampleId, key: failure.key, err: failure.error },
			"storage cleanup failed; file orphaned",
		);
	}

	await emit("samples", sampleId, "delete");

	return sample;
}
