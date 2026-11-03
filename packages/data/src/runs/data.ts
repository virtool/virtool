import type { IlluminaHeader } from "@virtool/bio/illumina";
import type {
	LibraryType,
	Run,
	RunEntry,
	RunMinimal,
	RunSearchResult,
} from "@virtool/contracts";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isForeignKeyViolation } from "../db/errors";
import { getPageCount, getPageOffset } from "../db/pagination";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { groups } from "../db/schema/groups";
import { instruments } from "../db/schema/instruments";
import { type RunRow, runEntries, runs } from "../db/schema/runs";
import { legacySamples } from "../db/schema/samples";
import { users } from "../db/schema/users";
import { toSearchPattern } from "../db/search";
import { AppError } from "../errors";
import { emit } from "../events/emit";
import { groupMinimalColumns } from "../groups/data";
import { canCreateFromInstrument, insertInstrument } from "../instruments/data";

/** The identity a FASTQ header gives a run. */
export type RunIdentity = Pick<
	IlluminaHeader,
	"flowcell" | "instrument" | "runNumber"
>;

/** One sample sheet entry, as a declared run records it. */
export type RunEntryValues = {
	index: string | null;
	index2: string | null;
	sampleName: string | null;
	sampleProject: string | null;
	sheetSampleId: string;
};

/** Fields accepted when declaring a run. */
export type CreateRunValues = {
	autoCreate: boolean;

	/**
	 * Lane rows sharing a `sheetSampleId` are collapsed into the first of them.
	 */
	entries: RunEntryValues[];
	groupId: number | null;
	libraryType: LibraryType;
	name: string;
	technicianId: number | null;
	userId: number;
};

/** Fields that can be changed on a run. */
export type UpdateRunValues = {
	autoCreate?: boolean;
	groupId?: number | null;
	libraryType?: LibraryType;
	name?: string;
	technicianId?: number | null;
};

/** Options accepted by {@link findRuns}. */
export type FindRunsOptions = {
	page: number;
	perPage: number;

	/** Matches the run name or flowcell */
	term: string;
};

/** Thrown when a requested run does not exist. */
export class RunNotFoundError extends AppError {}

/** Thrown when a run's default group does not exist. */
export class RunGroupNotFoundError extends AppError {}

/** Thrown when a run's technician does not exist. */
export class RunTechnicianNotFoundError extends AppError {}

/** Thrown when a run to claim already has a technician. */
export class RunAlreadyClaimedError extends AppError {}

/** Thrown when an owned instrument's run is claimed by a non-member. */
export class RunClaimForbiddenError extends AppError {}

const technicians = alias(users, "technicians");

function selectRuns(db: Db) {
	return db
		.select({
			run: runs,
			instrument: {
				id: instruments.id,
				name: instruments.name,
				serial: instruments.serial,
			},
			technician: { id: technicians.id, handle: technicians.handle },
			user: { id: users.id, handle: users.handle },
		})
		.from(runs)
		.leftJoin(instruments, eq(instruments.id, runs.instrumentId))
		.leftJoin(technicians, eq(technicians.id, runs.technicianId))
		.innerJoin(users, eq(users.id, runs.userId))
		.$dynamic();
}

type SelectedRun = Awaited<ReturnType<typeof selectRuns>>[number];

function toRunMinimal({
	run,
	instrument,
	technician,
	user,
}: SelectedRun): RunMinimal {
	return {
		id: run.id,
		createdAt: run.createdAt,
		flowcell: run.flowcell,
		instrument,
		name: run.name,
		origin: run.origin,
		runNumber: run.runNumber,
		technician,
		user,
	};
}

async function fetchEntries(db: Db, runId: number): Promise<RunEntry[]> {
	const rows = await db
		.select({
			entry: runEntries,
			sample: { id: legacySamples.id, name: legacySamples.name },
		})
		.from(runEntries)
		.leftJoin(legacySamples, eq(legacySamples.id, runEntries.sampleId))
		.where(eq(runEntries.runId, runId))
		.orderBy(runEntries.id);

	return rows.map(({ entry, sample }) => ({
		id: entry.id,
		claimedAt: entry.claimedAt,
		error: entry.error,
		index: entry.index,
		index2: entry.index2,
		sample,
		sampleName: entry.sampleName,
		sampleProject: entry.sampleProject,
		sheetSampleId: entry.sheetSampleId,
	}));
}

function mapRunReferenceError(error: unknown): never {
	if (isForeignKeyViolation(error, ["runs_group_id_fkey"])) {
		throw new RunGroupNotFoundError();
	}
	if (isForeignKeyViolation(error, ["runs_technician_id_fkey"])) {
		throw new RunTechnicianNotFoundError();
	}
	throw error;
}

async function getRunInstrumentId(
	db: Db,
	runId: number,
): Promise<number | null> {
	const [run] = await db
		.select({ instrumentId: runs.instrumentId })
		.from(runs)
		.where(eq(runs.id, runId));

	if (!run) {
		throw new RunNotFoundError();
	}

	return run.instrumentId;
}

/** A run on an owned instrument may only have a technician from an owning group. */
async function assertCanBeTechnician(
	db: Db,
	userId: number,
	instrumentId: number | null,
): Promise<void> {
	if (
		instrumentId !== null &&
		!(await canCreateFromInstrument(db, userId, instrumentId))
	) {
		throw new RunClaimForbiddenError();
	}
}

function collapseEntries(entries: RunEntryValues[]): RunEntryValues[] {
	const bySheetSampleId = new Map<string, RunEntryValues>();

	for (const entry of entries) {
		if (!bySheetSampleId.has(entry.sheetSampleId)) {
			bySheetSampleId.set(entry.sheetSampleId, entry);
		}
	}

	return [...bySheetSampleId.values()];
}

export async function getRun(db: Db, runId: number): Promise<Run> {
	const [selected] = await selectRuns(db).where(eq(runs.id, runId));

	if (!selected) {
		throw new RunNotFoundError();
	}

	const [entries, group] = await Promise.all([
		fetchEntries(db, runId),
		selected.run.groupId === null
			? undefined
			: db
					.select(groupMinimalColumns)
					.from(groups)
					.where(eq(groups.id, selected.run.groupId))
					.then(([row]) => row),
	]);

	return {
		...toRunMinimal(selected),
		autoCreate: selected.run.autoCreate,
		entries,
		group: group ?? null,
		libraryType: selected.run.libraryType,
		updatedAt: selected.run.updatedAt,
	};
}

export async function findRuns(
	db: Db,
	{ page, perPage, term }: FindRunsOptions,
): Promise<RunSearchResult> {
	const pattern = toSearchPattern(term);
	const filter = term
		? or(ilike(runs.name, pattern), ilike(runs.flowcell, pattern))
		: undefined;

	const [[foundRow], [totalRow], rows] = await Promise.all([
		db.select({ value: count() }).from(runs).where(filter),
		db.select({ value: count() }).from(runs),
		selectRuns(db)
			.where(filter)
			.orderBy(desc(runs.createdAt), desc(runs.id))
			.limit(perPage)
			.offset(getPageOffset(page, perPage)),
	]);

	const foundCount = foundRow?.value ?? 0;

	return {
		items: rows.map(toRunMinimal),
		foundCount,
		totalCount: totalRow?.value ?? 0,
		page,
		pageCount: getPageCount(foundCount, perPage),
		perPage,
	};
}

/** List the runs a user is the technician of, newest first. */
export async function listRunsForUser(
	db: Db,
	userId: number,
): Promise<RunMinimal[]> {
	const rows = await selectRuns(db)
		.where(eq(runs.technicianId, userId))
		.orderBy(desc(runs.createdAt), desc(runs.id));

	return rows.map(toRunMinimal);
}

/** Declare a run from a sample sheet, before any of its files arrive. */
export async function createRun(db: Db, values: CreateRunValues): Promise<Run> {
	const now = new Date();

	let row: RunRow;

	try {
		row = await db.transaction(async (tx) => {
			const run = takeFirstOrThrow(
				await tx
					.insert(runs)
					.values({
						autoCreate: values.autoCreate,
						createdAt: now,
						groupId: values.groupId,
						libraryType: values.libraryType,
						name: values.name,
						origin: "declared",
						technicianId: values.technicianId,
						updatedAt: now,
						userId: values.userId,
					})
					.returning(),
			);

			const entries = collapseEntries(values.entries);

			if (entries.length > 0) {
				await tx
					.insert(runEntries)
					.values(entries.map((entry) => ({ ...entry, runId: run.id })));
			}

			return run;
		});
	} catch (error) {
		mapRunReferenceError(error);
	}

	await emit("runs", row.id, "create");

	return getRun(db, row.id);
}

/**
 * Return the instrument and run a FASTQ header identifies, recording either
 * when it is new. A new run is `detected` and created by `userId`, the
 * uploader. Safe under concurrent calls with the same identity.
 */
export async function upsertInstrumentAndRun(
	db: Db,
	identity: RunIdentity,
	userId: number,
): Promise<{ instrumentId: number; runId: number }> {
	const [inserted] = await insertInstrument(db, {
		serial: identity.instrument,
	});

	const instrumentId =
		inserted?.id ??
		takeFirstOrThrow(
			await db
				.select({ id: instruments.id })
				.from(instruments)
				.where(eq(instruments.serial, identity.instrument)),
		).id;

	const now = new Date();

	const [created] = await db
		.insert(runs)
		.values({
			autoCreate: false,
			createdAt: now,
			flowcell: identity.flowcell,
			groupId: null,
			instrumentId,
			libraryType: "normal",
			name: `${identity.instrument}_${identity.runNumber}_${identity.flowcell}`,
			origin: "detected",
			runNumber: identity.runNumber,
			technicianId: null,
			updatedAt: now,
			userId,
		})
		.onConflictDoNothing({
			target: [runs.instrumentId, runs.runNumber, runs.flowcell],
		})
		.returning({ id: runs.id });

	if (created) {
		await emit("runs", created.id, "create");

		return { instrumentId, runId: created.id };
	}

	const existing = takeFirstOrThrow(
		await db
			.select({ id: runs.id })
			.from(runs)
			.where(
				and(
					eq(runs.instrumentId, instrumentId),
					eq(runs.runNumber, identity.runNumber),
					eq(runs.flowcell, identity.flowcell),
				),
			),
	);

	return { instrumentId, runId: existing.id };
}

export async function updateRun(
	db: Db,
	runId: number,
	values: UpdateRunValues,
): Promise<Run> {
	if (Object.keys(values).length === 0) {
		return getRun(db, runId);
	}

	if (typeof values.technicianId === "number") {
		await assertCanBeTechnician(
			db,
			values.technicianId,
			await getRunInstrumentId(db, runId),
		);
	}

	let updated: { id: number }[] = [];

	try {
		updated = await db
			.update(runs)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(runs.id, runId))
			.returning({ id: runs.id });
	} catch (error) {
		mapRunReferenceError(error);
	}

	if (updated.length === 0) {
		throw new RunNotFoundError();
	}

	await emit("runs", runId, "update");

	return getRun(db, runId);
}

/**
 * Make a user the technician of a run that has none. A run on an owned
 * instrument may only be claimed by a member of an owning group.
 */
export async function claimRun(
	db: Db,
	runId: number,
	userId: number,
): Promise<Run> {
	await assertCanBeTechnician(db, userId, await getRunInstrumentId(db, runId));

	const claimed = await db
		.update(runs)
		.set({ technicianId: userId, updatedAt: new Date() })
		.where(and(eq(runs.id, runId), isNull(runs.technicianId)))
		.returning({ id: runs.id });

	if (claimed.length === 0) {
		throw new RunAlreadyClaimedError();
	}

	await emit("runs", runId, "update");

	return getRun(db, runId);
}
