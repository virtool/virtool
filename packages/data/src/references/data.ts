import type {
	Reference,
	ReferenceBuild,
	ReferenceContributor,
	ReferenceCreateRequest,
	ReferenceGroup,
	ReferenceImportedFrom,
	ReferenceMinimal,
	ReferenceRight,
	ReferenceRights,
	ReferenceSearchResult,
	ReferenceUpdateRequest,
	ReferenceUser,
	Task,
} from "@virtool/contracts";
import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	inArray,
	or,
	type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { groups, userGroups } from "../db/schema/groups";
import { legacyHistory } from "../db/schema/history";
import { indexes } from "../db/schema/indexes";
import { legacyOtus } from "../db/schema/otus";
import {
	legacyReferenceGroups,
	legacyReferences,
	legacyReferenceUsers,
} from "../db/schema/references";
import { tasks } from "../db/schema/tasks";
import { uploads } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { AppError } from "../errors";
import { getSettings } from "../settings/data";
import { createTask, type TaskType } from "../tasks/data";

/** Filters and pagination accepted by {@link findReferences}. */
export type FindReferencesOptions = {
	page: number;
	perPage: number;
	term: string;
	archived?: boolean;
};

/** The fields a reference is created from, plus the creating user. */
export type CreateReferenceValues = ReferenceCreateRequest & {
	userId: number;
};

/** The caller resolved to the identity used for per-reference authorization. */
export type ReferenceActor = {
	userId: number;
	groupIds: number[];
	isAdmin: boolean;
};

/** Thrown when a requested reference does not exist. */
export class ReferenceNotFoundError extends AppError {}

/** Thrown when a reference cannot be updated because it is archived. */
export class ReferenceArchivedError extends AppError {}

/** Thrown when the reference a clone is created from does not exist. */
export class ReferenceCloneSourceNotFoundError extends AppError {}

/** Thrown when the upload a reference is imported from does not exist. */
export class ReferenceImportUploadNotFoundError extends AppError {}

/** Thrown when a membership operation targets a non-existent member row. */
export class ReferenceMemberNotFoundError extends AppError {}

/** Thrown when a membership operation conflicts (unknown or duplicate member). */
export class ReferenceMemberConflictError extends AppError {}

// The Python endpoint escapes LIKE wildcards in the search term so a user's `%`
// or `_` matches literally rather than acting as a pattern.
function escapeLike(term: string): string {
	return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const ownerUser = alias(users, "owner_user");
const uploadUser = alias(users, "upload_user");
const clonedRef = alias(legacyReferences, "cloned_ref");

// A reference row joined to its owning user, its create/clone/import task, the
// reference it was cloned from, and the upload it was imported from (with that
// upload's uploader) — the shape every read maps into a `ReferenceMinimal`.
function selectReferences(db: DbOrTx) {
	return db
		.select({
			id: legacyReferences.id,
			name: legacyReferences.name,
			organism: legacyReferences.organism,
			created_at: legacyReferences.created_at,
			archived: legacyReferences.archived,
			description: legacyReferences.description,
			restrict_source_types: legacyReferences.restrict_source_types,
			source_types: legacyReferences.source_types,
			ownerId: ownerUser.id,
			ownerHandle: ownerUser.handle,
			clonedFromId: legacyReferences.cloned_from_id,
			clonedFromName: clonedRef.name,
			taskId: tasks.id,
			taskComplete: tasks.complete,
			taskCreatedAt: tasks.created_at,
			taskError: tasks.error,
			taskProgress: tasks.progress,
			taskStep: tasks.step,
			taskType: tasks.type,
			uploadId: uploads.id,
			uploadName: uploads.name,
			uploadCreatedAt: uploads.createdAt,
			uploadSize: uploads.size,
			uploadUserId: uploadUser.id,
			uploadUserHandle: uploadUser.handle,
		})
		.from(legacyReferences)
		.leftJoin(ownerUser, eq(legacyReferences.user_id, ownerUser.id))
		.leftJoin(clonedRef, eq(legacyReferences.cloned_from_id, clonedRef.id))
		.leftJoin(tasks, eq(legacyReferences.task_id, tasks.id))
		.leftJoin(uploads, eq(legacyReferences.upload_id, uploads.id))
		.leftJoin(uploadUser, eq(uploads.userId, uploadUser.id));
}

type ReferenceResourceRow = Awaited<
	ReturnType<typeof selectReferences>
>[number];

function mapMinimal(
	row: ReferenceResourceRow,
	otuCount: number,
	latestBuild: ReferenceBuild | null,
): ReferenceMinimal {
	const task: Task | null =
		row.taskId == null
			? null
			: {
					complete: row.taskComplete ?? false,
					created_at: row.taskCreatedAt ?? new Date(),
					error: row.taskError,
					id: row.taskId,
					progress: row.taskProgress ?? 0,
					step: row.taskStep ?? "",
					type: row.taskType ?? "",
				};

	const importedFrom: ReferenceImportedFrom | null =
		row.uploadId == null
			? null
			: {
					id: row.uploadId,
					name: row.uploadName ?? "",
					createdAt: row.uploadCreatedAt ?? null,
					size: row.uploadSize ?? null,
					user:
						row.uploadUserId == null
							? null
							: { id: row.uploadUserId, handle: row.uploadUserHandle ?? "" },
				};

	return {
		id: row.id,
		dataType: "genome",
		name: row.name,
		archived: row.archived,
		clonedFrom:
			row.clonedFromId == null
				? null
				: { id: row.clonedFromId, name: row.clonedFromName ?? "" },
		createdAt: row.created_at,
		importedFrom,
		latestBuild,
		organism: row.organism,
		otuCount,
		task,
		user:
			row.ownerId == null
				? null
				: { id: row.ownerId, handle: row.ownerHandle ?? "" },
	};
}

async function getOtuCounts(
	db: DbOrTx,
	referenceIds: number[],
): Promise<Map<number, number>> {
	if (referenceIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({ referenceId: legacyOtus.reference_id, value: count() })
		.from(legacyOtus)
		.where(inArray(legacyOtus.reference_id, referenceIds))
		.groupBy(legacyOtus.reference_id);

	return new Map(rows.map((row) => [row.referenceId, row.value]));
}

// The latest ready build per reference: order by version then id descending and
// keep the first row seen for each reference, matching Python's `DISTINCT ON`.
async function getLatestBuilds(
	db: DbOrTx,
	referenceIds: number[],
): Promise<Map<number, ReferenceBuild>> {
	if (referenceIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.select({
			referenceId: indexes.reference_id,
			id: indexes.id,
			version: indexes.version,
			createdAt: indexes.created_at,
			userId: users.id,
			userHandle: users.handle,
		})
		.from(indexes)
		.innerJoin(users, eq(indexes.user_id, users.id))
		.where(
			and(inArray(indexes.reference_id, referenceIds), eq(indexes.ready, true)),
		)
		.orderBy(
			asc(indexes.reference_id),
			desc(indexes.version),
			desc(indexes.id),
		);

	const builds = new Map<number, ReferenceBuild>();

	for (const row of rows) {
		if (row.referenceId != null && !builds.has(row.referenceId)) {
			builds.set(row.referenceId, {
				id: row.id,
				version: row.version ?? 0,
				createdAt: row.createdAt ?? new Date(),
				user: { id: row.userId, handle: row.userHandle },
			});
		}
	}

	return builds;
}

async function getContributors(
	db: DbOrTx,
	referenceId: number,
): Promise<ReferenceContributor[]> {
	const rows = await db
		.select({ id: users.id, handle: users.handle, value: count() })
		.from(legacyHistory)
		.innerJoin(users, eq(legacyHistory.user_id, users.id))
		.where(eq(legacyHistory.reference_id, referenceId))
		.groupBy(users.id, users.handle)
		.orderBy(asc(users.id));

	return rows.map((row) => ({
		id: row.id,
		handle: row.handle,
		count: row.value,
	}));
}

// A per-member `created_at` is not stored, so Python stamps the reference's own
// creation time onto every member row; this mirrors that.
async function getReferenceUsers(
	db: DbOrTx,
	referenceId: number,
	createdAt: Date,
): Promise<ReferenceUser[]> {
	const rows = await db
		.select({
			id: users.id,
			handle: users.handle,
			build: legacyReferenceUsers.build,
			modify: legacyReferenceUsers.modify,
			modifyOtu: legacyReferenceUsers.modify_otu,
		})
		.from(legacyReferenceUsers)
		.innerJoin(users, eq(legacyReferenceUsers.user_id, users.id))
		.where(eq(legacyReferenceUsers.reference_id, referenceId))
		.orderBy(asc(users.id));

	return rows.map((row) => ({ ...row, createdAt }));
}

async function getReferenceGroups(
	db: DbOrTx,
	referenceId: number,
	createdAt: Date,
): Promise<ReferenceGroup[]> {
	const rows = await db
		.select({
			id: groups.id,
			name: groups.name,
			build: legacyReferenceGroups.build,
			modify: legacyReferenceGroups.modify,
			modifyOtu: legacyReferenceGroups.modify_otu,
		})
		.from(legacyReferenceGroups)
		.innerJoin(groups, eq(legacyReferenceGroups.group_id, groups.id))
		.where(eq(legacyReferenceGroups.reference_id, referenceId))
		.orderBy(asc(groups.id));

	return rows.map((row) => ({ ...row, createdAt }));
}

/** Resolve a user id to the identity used for per-reference authorization. */
export async function resolveReferenceActor(
	db: Db,
	userId: number,
): Promise<ReferenceActor> {
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
		// The full administrator role bypasses every per-reference right, matching
		// the client's `useCheckReferenceRight`.
		isAdmin: userRows[0]?.role === "full",
	};
}

/**
 * Whether `actor` holds `right` on a reference. A full administrator holds every
 * right; otherwise a user membership row or any of the caller's group membership
 * rows with the flag set grants it — additively, either can grant.
 *
 * Throws {@link ReferenceNotFoundError} for a non-administrator when the
 * reference does not exist, mirroring Python's `check_right`.
 */
export async function checkReferenceRight(
	db: Db,
	referenceId: number,
	right: ReferenceRight,
	actor: ReferenceActor,
): Promise<boolean> {
	if (actor.isAdmin) {
		return true;
	}

	const [reference] = await db
		.select({ id: legacyReferences.id })
		.from(legacyReferences)
		.where(eq(legacyReferences.id, referenceId))
		.limit(1);

	if (!reference) {
		throw new ReferenceNotFoundError();
	}

	const userColumn =
		right === "build"
			? legacyReferenceUsers.build
			: right === "modify"
				? legacyReferenceUsers.modify
				: legacyReferenceUsers.modify_otu;

	const [userRow] = await db
		.select({ id: legacyReferenceUsers.user_id })
		.from(legacyReferenceUsers)
		.where(
			and(
				eq(legacyReferenceUsers.reference_id, referenceId),
				eq(legacyReferenceUsers.user_id, actor.userId),
				eq(userColumn, true),
			),
		)
		.limit(1);

	if (userRow) {
		return true;
	}

	if (actor.groupIds.length > 0) {
		const groupColumn =
			right === "build"
				? legacyReferenceGroups.build
				: right === "modify"
					? legacyReferenceGroups.modify
					: legacyReferenceGroups.modify_otu;

		const [groupRow] = await db
			.select({ id: legacyReferenceGroups.reference_id })
			.from(legacyReferenceGroups)
			.where(
				and(
					eq(legacyReferenceGroups.reference_id, referenceId),
					inArray(legacyReferenceGroups.group_id, actor.groupIds),
					eq(groupColumn, true),
				),
			)
			.limit(1);

		if (groupRow) {
			return true;
		}
	}

	return false;
}

/**
 * Whether `actor` may see a reference at all — the single-row form of
 * {@link referenceVisibilityFilter}, so detail read enforces the same rule the
 * list does. A full administrator sees every reference; otherwise ownership, any
 * user membership row, or any group membership row grants visibility, regardless
 * of the rights flags on that row.
 *
 * Returns `false` for both a missing reference and one the actor cannot see, so
 * the caller can collapse the two into an indistinguishable 404.
 */
export async function checkReferenceVisibility(
	db: Db,
	referenceId: number,
	actor: ReferenceActor,
): Promise<boolean> {
	if (actor.isAdmin) {
		return true;
	}

	const [row] = await db
		.select({ id: legacyReferences.id })
		.from(legacyReferences)
		.where(
			and(
				eq(legacyReferences.id, referenceId),
				referenceVisibilityFilter(db, actor),
			),
		)
		.limit(1);

	return Boolean(row);
}

// The rows a non-administrator may see: references they own, plus references
// they can reach through a user or group membership row.
function referenceVisibilityFilter(
	db: Db,
	actor: ReferenceActor,
): SQL | undefined {
	if (actor.isAdmin) {
		return undefined;
	}

	const clauses = [
		eq(legacyReferences.user_id, actor.userId),
		inArray(
			legacyReferences.id,
			db
				.select({ id: legacyReferenceUsers.reference_id })
				.from(legacyReferenceUsers)
				.where(eq(legacyReferenceUsers.user_id, actor.userId)),
		),
	];

	if (actor.groupIds.length > 0) {
		clauses.push(
			inArray(
				legacyReferences.id,
				db
					.select({ id: legacyReferenceGroups.reference_id })
					.from(legacyReferenceGroups)
					.where(inArray(legacyReferenceGroups.group_id, actor.groupIds)),
			),
		);
	}

	return or(...clauses);
}

export async function findReferences(
	db: Db,
	{ page, perPage, term, archived }: FindReferencesOptions,
	actor: ReferenceActor,
): Promise<ReferenceSearchResult> {
	const visibility = referenceVisibilityFilter(db, actor);
	const archivedFilter =
		archived === undefined
			? undefined
			: eq(legacyReferences.archived, archived);
	const searchFilter = term
		? ilike(legacyReferences.name, `%${escapeLike(term)}%`)
		: undefined;

	const baseFilter = and(visibility, archivedFilter);
	const foundFilter = and(baseFilter, searchFilter);

	const [totalRows, foundRows, rows] = await Promise.all([
		db.select({ value: count() }).from(legacyReferences).where(baseFilter),
		// Without a search term the found count equals the total count, so skip the
		// redundant query and reuse totalCount below.
		searchFilter
			? db.select({ value: count() }).from(legacyReferences).where(foundFilter)
			: undefined,
		selectReferences(db)
			.where(foundFilter)
			.orderBy(asc(legacyReferences.name), asc(legacyReferences.id))
			.offset((page - 1) * perPage)
			.limit(perPage),
	]);

	const totalCount = takeFirstOrThrow(totalRows).value;
	const foundCount = foundRows ? takeFirstOrThrow(foundRows).value : totalCount;

	const referenceIds = rows.map((row) => row.id);
	const [otuCounts, latestBuilds] = await Promise.all([
		getOtuCounts(db, referenceIds),
		getLatestBuilds(db, referenceIds),
	]);

	return {
		foundCount,
		totalCount,
		page,
		pageCount: foundCount ? Math.ceil(foundCount / perPage) : 0,
		perPage,
		items: rows.map((row) =>
			mapMinimal(
				row,
				otuCounts.get(row.id) ?? 0,
				latestBuilds.get(row.id) ?? null,
			),
		),
	};
}

export async function getReference(
	db: Db,
	referenceId: number,
): Promise<Reference> {
	const [row] = await selectReferences(db).where(
		eq(legacyReferences.id, referenceId),
	);

	if (!row) {
		throw new ReferenceNotFoundError();
	}

	const [
		otuCounts,
		latestBuilds,
		contributors,
		referenceUsers,
		referenceGroups,
	] = await Promise.all([
		getOtuCounts(db, [referenceId]),
		getLatestBuilds(db, [referenceId]),
		getContributors(db, referenceId),
		getReferenceUsers(db, referenceId, row.created_at),
		getReferenceGroups(db, referenceId, row.created_at),
	]);

	return {
		...mapMinimal(
			row,
			otuCounts.get(referenceId) ?? 0,
			latestBuilds.get(referenceId) ?? null,
		),
		contributors,
		description: row.description,
		groups: referenceGroups,
		restrictSourceTypes: row.restrict_source_types,
		sourceTypes: row.source_types,
		users: referenceUsers,
	};
}

async function getReferenceRow(db: DbOrTx, referenceId: number) {
	const [row] = await db
		.select({
			id: legacyReferences.id,
			created_at: legacyReferences.created_at,
			archived: legacyReferences.archived,
		})
		.from(legacyReferences)
		.where(eq(legacyReferences.id, referenceId))
		.limit(1);

	if (!row) {
		throw new ReferenceNotFoundError();
	}

	return row;
}

export async function createReference(
	db: Db,
	values: CreateReferenceValues,
): Promise<Reference> {
	// New references seed their allowed source types from the instance settings,
	// for every creation mode (empty, clone, and import), matching Python.
	const settings = await getSettings(db);

	const newId = await db.transaction(async (tx) => {
		let name = values.name;
		let organism = values.organism;
		let clonedFromId: number | null = null;
		let uploadId: number | null = null;
		let taskType: TaskType | null = null;
		let taskContext: Record<string, unknown> = {};

		if (values.cloneFrom !== undefined) {
			const [source] = await tx
				.select({
					id: legacyReferences.id,
					name: legacyReferences.name,
					organism: legacyReferences.organism,
				})
				.from(legacyReferences)
				.where(eq(legacyReferences.id, values.cloneFrom))
				.limit(1);

			if (!source) {
				throw new ReferenceCloneSourceNotFoundError();
			}

			name = name || `Clone of ${source.name}`;
			organism = source.organism;
			clonedFromId = source.id;

			const otuRows = await tx
				.select({ id: legacyOtus.id, version: legacyOtus.version })
				.from(legacyOtus)
				.where(eq(legacyOtus.reference_id, source.id));

			const manifest: Record<string, number> = {};
			for (const otu of otuRows) {
				manifest[otu.id] = otu.version;
			}

			taskType = "clone_reference";
			taskContext = { manifest, user_id: values.userId };
		} else if (values.importFrom !== undefined) {
			const [upload] = await tx
				.select({ id: uploads.id, nameOnDisk: uploads.nameOnDisk })
				.from(uploads)
				.where(eq(uploads.id, values.importFrom))
				.limit(1);

			if (!upload) {
				throw new ReferenceImportUploadNotFoundError();
			}

			uploadId = upload.id;
			taskType = "import_reference";
			taskContext = { name_on_disk: upload.nameOnDisk, user_id: values.userId };
		}

		const reference = takeFirstOrThrow(
			await tx
				.insert(legacyReferences)
				.values({
					name,
					description: values.description,
					organism,
					created_at: new Date(),
					archived: false,
					restrict_source_types: false,
					source_types: settings.defaultSourceTypes,
					user_id: values.userId,
					upload_id: uploadId,
					cloned_from_id: clonedFromId,
				})
				.returning({ id: legacyReferences.id }),
		);

		// The creator is seeded as a member with every right.
		await tx.insert(legacyReferenceUsers).values({
			reference_id: reference.id,
			user_id: values.userId,
			build: true,
			modify: true,
			modify_otu: true,
		});

		if (taskType) {
			const taskId = await createTask(tx, taskType, {
				...taskContext,
				ref_id: reference.id,
			});

			await tx
				.update(legacyReferences)
				.set({ task_id: taskId })
				.where(eq(legacyReferences.id, reference.id));
		}

		return reference.id;
	});

	return getReference(db, newId);
}

export async function updateReference(
	db: Db,
	referenceId: number,
	values: ReferenceUpdateRequest,
): Promise<Reference> {
	const reference = await getReferenceRow(db, referenceId);

	if (reference.archived) {
		throw new ReferenceArchivedError();
	}

	const patch: Record<string, unknown> = {};
	if (values.name !== undefined) {
		patch.name = values.name;
	}
	if (values.description !== undefined) {
		patch.description = values.description;
	}
	if (values.organism !== undefined) {
		patch.organism = values.organism;
	}
	if (values.restrictSourceTypes !== undefined) {
		patch.restrict_source_types = values.restrictSourceTypes;
	}
	if (values.sourceTypes !== undefined) {
		patch.source_types = values.sourceTypes;
	}

	if (Object.keys(patch).length > 0) {
		await db
			.update(legacyReferences)
			.set(patch)
			.where(eq(legacyReferences.id, referenceId));
	}

	return getReference(db, referenceId);
}

export async function setReferenceArchived(
	db: Db,
	referenceId: number,
	archived: boolean,
): Promise<Reference> {
	await getReferenceRow(db, referenceId);

	await db
		.update(legacyReferences)
		.set({ archived })
		.where(eq(legacyReferences.id, referenceId));

	return getReference(db, referenceId);
}

export async function addReferenceUser(
	db: Db,
	referenceId: number,
	userId: number,
	rights: Partial<ReferenceRights>,
): Promise<ReferenceUser> {
	const reference = await getReferenceRow(db, referenceId);

	const [user] = await db
		.select({ id: users.id, handle: users.handle })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw new ReferenceMemberConflictError("User does not exist.");
	}

	const [existing] = await db
		.select({ userId: legacyReferenceUsers.user_id })
		.from(legacyReferenceUsers)
		.where(
			and(
				eq(legacyReferenceUsers.reference_id, referenceId),
				eq(legacyReferenceUsers.user_id, userId),
			),
		)
		.limit(1);

	if (existing) {
		throw new ReferenceMemberConflictError("User is already a member.");
	}

	const resolved: ReferenceRights = {
		build: rights.build ?? false,
		modify: rights.modify ?? false,
		modifyOtu: rights.modifyOtu ?? false,
	};

	await db.insert(legacyReferenceUsers).values({
		reference_id: referenceId,
		user_id: userId,
		build: resolved.build,
		modify: resolved.modify,
		modify_otu: resolved.modifyOtu,
	});

	return {
		id: user.id,
		handle: user.handle,
		...resolved,
		createdAt: reference.created_at,
	};
}

export async function addReferenceGroup(
	db: Db,
	referenceId: number,
	groupId: number,
	rights: Partial<ReferenceRights>,
): Promise<ReferenceGroup> {
	const reference = await getReferenceRow(db, referenceId);

	const [group] = await db
		.select({ id: groups.id, name: groups.name })
		.from(groups)
		.where(eq(groups.id, groupId))
		.limit(1);

	if (!group) {
		throw new ReferenceMemberConflictError("Group does not exist.");
	}

	const [existing] = await db
		.select({ groupId: legacyReferenceGroups.group_id })
		.from(legacyReferenceGroups)
		.where(
			and(
				eq(legacyReferenceGroups.reference_id, referenceId),
				eq(legacyReferenceGroups.group_id, groupId),
			),
		)
		.limit(1);

	if (existing) {
		throw new ReferenceMemberConflictError("Group is already a member.");
	}

	const resolved: ReferenceRights = {
		build: rights.build ?? false,
		modify: rights.modify ?? false,
		modifyOtu: rights.modifyOtu ?? false,
	};

	await db.insert(legacyReferenceGroups).values({
		reference_id: referenceId,
		group_id: groupId,
		build: resolved.build,
		modify: resolved.modify,
		modify_otu: resolved.modifyOtu,
	});

	return {
		id: group.id,
		name: group.name,
		...resolved,
		createdAt: reference.created_at,
	};
}

export async function updateReferenceUser(
	db: Db,
	referenceId: number,
	userId: number,
	rights: Partial<ReferenceRights>,
): Promise<ReferenceUser> {
	const reference = await getReferenceRow(db, referenceId);

	const [row] = await db
		.select({
			handle: users.handle,
			build: legacyReferenceUsers.build,
			modify: legacyReferenceUsers.modify,
			modifyOtu: legacyReferenceUsers.modify_otu,
		})
		.from(legacyReferenceUsers)
		.innerJoin(users, eq(legacyReferenceUsers.user_id, users.id))
		.where(
			and(
				eq(legacyReferenceUsers.reference_id, referenceId),
				eq(legacyReferenceUsers.user_id, userId),
			),
		)
		.limit(1);

	if (!row) {
		throw new ReferenceMemberNotFoundError();
	}

	// Partial merge: only rights present in the request overwrite the row.
	const merged: ReferenceRights = {
		build: rights.build ?? row.build,
		modify: rights.modify ?? row.modify,
		modifyOtu: rights.modifyOtu ?? row.modifyOtu,
	};

	await db
		.update(legacyReferenceUsers)
		.set({
			build: merged.build,
			modify: merged.modify,
			modify_otu: merged.modifyOtu,
		})
		.where(
			and(
				eq(legacyReferenceUsers.reference_id, referenceId),
				eq(legacyReferenceUsers.user_id, userId),
			),
		);

	return {
		id: userId,
		handle: row.handle,
		...merged,
		createdAt: reference.created_at,
	};
}

export async function updateReferenceGroup(
	db: Db,
	referenceId: number,
	groupId: number,
	rights: Partial<ReferenceRights>,
): Promise<ReferenceGroup> {
	const reference = await getReferenceRow(db, referenceId);

	const [row] = await db
		.select({
			name: groups.name,
			build: legacyReferenceGroups.build,
			modify: legacyReferenceGroups.modify,
			modifyOtu: legacyReferenceGroups.modify_otu,
		})
		.from(legacyReferenceGroups)
		.innerJoin(groups, eq(legacyReferenceGroups.group_id, groups.id))
		.where(
			and(
				eq(legacyReferenceGroups.reference_id, referenceId),
				eq(legacyReferenceGroups.group_id, groupId),
			),
		)
		.limit(1);

	if (!row) {
		throw new ReferenceMemberNotFoundError();
	}

	const merged: ReferenceRights = {
		build: rights.build ?? row.build,
		modify: rights.modify ?? row.modify,
		modifyOtu: rights.modifyOtu ?? row.modifyOtu,
	};

	await db
		.update(legacyReferenceGroups)
		.set({
			build: merged.build,
			modify: merged.modify,
			modify_otu: merged.modifyOtu,
		})
		.where(
			and(
				eq(legacyReferenceGroups.reference_id, referenceId),
				eq(legacyReferenceGroups.group_id, groupId),
			),
		);

	return {
		id: groupId,
		name: row.name,
		...merged,
		createdAt: reference.created_at,
	};
}

export async function removeReferenceUser(
	db: Db,
	referenceId: number,
	userId: number,
): Promise<void> {
	const removed = await db
		.delete(legacyReferenceUsers)
		.where(
			and(
				eq(legacyReferenceUsers.reference_id, referenceId),
				eq(legacyReferenceUsers.user_id, userId),
			),
		)
		.returning({ userId: legacyReferenceUsers.user_id });

	if (removed.length === 0) {
		throw new ReferenceMemberNotFoundError();
	}
}

export async function removeReferenceGroup(
	db: Db,
	referenceId: number,
	groupId: number,
): Promise<void> {
	const removed = await db
		.delete(legacyReferenceGroups)
		.where(
			and(
				eq(legacyReferenceGroups.reference_id, referenceId),
				eq(legacyReferenceGroups.group_id, groupId),
			),
		)
		.returning({ groupId: legacyReferenceGroups.group_id });

	if (removed.length === 0) {
		throw new ReferenceMemberNotFoundError();
	}
}
