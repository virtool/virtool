import { inferInstrumentModel } from "@virtool/bio/illumina";
import type { GroupMinimal, Instrument } from "@virtool/contracts";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { isForeignKeyViolation } from "../db/errors";
import type { Db } from "../db/pg";
import { groups, userGroups } from "../db/schema/groups";
import {
	type InstrumentRow,
	instrumentGroups,
	instruments,
} from "../db/schema/instruments";
import { AppError } from "../errors";
import { groupMinimalColumns } from "../groups/data";

/** Fields accepted when creating an instrument. */
export type CreateInstrumentValues = {
	/** Defaults to the model inferred from the serial */
	model?: string | null;

	/** Defaults to the serial */
	name?: string;
	serial: string;
};

/** Fields that can be changed on an instrument. */
export type UpdateInstrumentValues = {
	/** Replaces the owning groups */
	groups?: number[];
	model?: string | null;
	name?: string;
};

/** Thrown when a requested instrument does not exist. */
export class InstrumentNotFoundError extends AppError {}

/** Thrown when an instrument serial is already recorded. */
export class InstrumentConflictError extends AppError {}

/** Thrown when an instrument to delete still has runs. */
export class InstrumentInUseError extends AppError {}

/** Thrown when an owning group does not exist. */
export class InstrumentGroupNotFoundError extends AppError {}

async function fetchOwners(
	db: Db,
	instrumentIds: number[],
): Promise<Map<number, GroupMinimal[]>> {
	const owners = new Map<number, GroupMinimal[]>(
		instrumentIds.map((id) => [id, []]),
	);

	if (instrumentIds.length === 0) {
		return owners;
	}

	const rows = await db
		.select({
			instrumentId: instrumentGroups.instrumentId,
			...groupMinimalColumns,
		})
		.from(instrumentGroups)
		.innerJoin(groups, eq(groups.id, instrumentGroups.groupId))
		.where(inArray(instrumentGroups.instrumentId, instrumentIds))
		.orderBy(asc(groups.name));

	for (const { instrumentId, ...group } of rows) {
		owners.get(instrumentId)?.push(group);
	}

	return owners;
}

function toInstrument(row: InstrumentRow, owners: GroupMinimal[]): Instrument {
	return {
		id: row.id,
		createdAt: row.createdAt,
		groups: owners,
		model: row.model,
		name: row.name,
		serial: row.serial,
	};
}

/**
 * Insert an instrument. The model is only a guess from the serial prefix and
 * is never applied over one the caller supplies.
 */
export function insertInstrument(db: Db, values: CreateInstrumentValues) {
	return db
		.insert(instruments)
		.values({
			createdAt: new Date(),
			model:
				values.model === undefined
					? inferInstrumentModel(values.serial)
					: values.model,
			name: values.name ?? values.serial,
			serial: values.serial,
		})
		.onConflictDoNothing({ target: instruments.serial })
		.returning();
}

async function replaceOwners(
	db: Db,
	instrumentId: number,
	groupIds: number[],
): Promise<void> {
	try {
		await db.transaction(async (tx) => {
			await tx
				.delete(instrumentGroups)
				.where(eq(instrumentGroups.instrumentId, instrumentId));

			if (groupIds.length > 0) {
				await tx.insert(instrumentGroups).values(
					[...new Set(groupIds)].map((groupId) => ({
						instrumentId,
						groupId,
					})),
				);
			}
		});
	} catch (error) {
		if (isForeignKeyViolation(error, ["instrument_groups_group_id_fkey"])) {
			throw new InstrumentGroupNotFoundError();
		}
		throw error;
	}
}

export async function findInstruments(db: Db): Promise<Instrument[]> {
	const rows = await db
		.select()
		.from(instruments)
		.orderBy(asc(instruments.name));

	const owners = await fetchOwners(
		db,
		rows.map((row) => row.id),
	);

	return rows.map((row) => toInstrument(row, owners.get(row.id) ?? []));
}

export async function getInstrument(
	db: Db,
	instrumentId: number,
): Promise<Instrument> {
	const [row] = await db
		.select()
		.from(instruments)
		.where(eq(instruments.id, instrumentId));

	if (!row) {
		throw new InstrumentNotFoundError();
	}

	const owners = await fetchOwners(db, [row.id]);

	return toInstrument(row, owners.get(row.id) ?? []);
}

export async function createInstrument(
	db: Db,
	values: CreateInstrumentValues,
): Promise<Instrument> {
	const [row] = await insertInstrument(db, values);

	if (!row) {
		throw new InstrumentConflictError();
	}

	return toInstrument(row, []);
}

export async function updateInstrument(
	db: Db,
	instrumentId: number,
	values: UpdateInstrumentValues,
): Promise<Instrument> {
	const patch = {
		...(values.model !== undefined && { model: values.model }),
		...(values.name !== undefined && { name: values.name }),
	};

	const [row] =
		Object.keys(patch).length > 0
			? await db
					.update(instruments)
					.set(patch)
					.where(eq(instruments.id, instrumentId))
					.returning()
			: await db
					.select()
					.from(instruments)
					.where(eq(instruments.id, instrumentId));

	if (!row) {
		throw new InstrumentNotFoundError();
	}

	if (values.groups !== undefined) {
		await replaceOwners(db, instrumentId, values.groups);
	}

	const owners = await fetchOwners(db, [row.id]);

	return toInstrument(row, owners.get(row.id) ?? []);
}

export async function deleteInstrument(
	db: Db,
	instrumentId: number,
): Promise<void> {
	let deleted: { id: number }[];

	try {
		deleted = await db
			.delete(instruments)
			.where(eq(instruments.id, instrumentId))
			.returning({ id: instruments.id });
	} catch (error) {
		if (isForeignKeyViolation(error, ["runs_instrument_id_fkey"])) {
			throw new InstrumentInUseError();
		}
		throw error;
	}

	if (deleted.length === 0) {
		throw new InstrumentNotFoundError();
	}
}

/**
 * Report whether a user may create samples from the uploads of an instrument.
 * An instrument with no owning groups is open to everyone; an owned one only
 * to members of an owning group. Ownership never decides the sample's group.
 */
export async function canCreateFromInstrument(
	db: Db,
	userId: number,
	instrumentId: number,
): Promise<boolean> {
	const [row] = await db
		.select({
			owners: count(),
			memberships: count(userGroups.userId),
		})
		.from(instrumentGroups)
		.leftJoin(
			userGroups,
			and(
				eq(userGroups.groupId, instrumentGroups.groupId),
				eq(userGroups.userId, userId),
			),
		)
		.where(eq(instrumentGroups.instrumentId, instrumentId));

	return row === undefined || row.owners === 0 || row.memberships > 0;
}
