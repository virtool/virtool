import { DEFAULT_LABEL_COLOR, type Label } from "@virtool/contracts";
import { asc, count, eq, ilike } from "drizzle-orm";
import type { PostgresError } from "postgres";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { type LabelRow, labels as labelsTable } from "../db/schema/labels";
import { legacySampleLabels } from "../db/schema/samples";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/** Label fields accepted by create/update operations. */
export type LabelValues = {
	color: string;
	description: string;
	name: string;
};

/** Thrown when a requested label does not exist. */
export class LabelNotFoundError extends AppError {}

/** Thrown when a label name conflicts with an existing label. */
export class LabelConflictError extends AppError {}

function isUniqueViolation(error: unknown): boolean {
	const cause = (error as { cause?: unknown }).cause;
	return (
		(error as Partial<PostgresError>).code === "23505" ||
		(cause as Partial<PostgresError> | undefined)?.code === "23505"
	);
}

function normalizeColor(color: string | null): string {
	if (!color) {
		return DEFAULT_LABEL_COLOR;
	}
	return color.startsWith("#") ? color : `#${color}`;
}

function toLabel(row: LabelRow, sampleCount: number): Label {
	return {
		id: row.id,
		color: normalizeColor(row.color),
		count: sampleCount,
		description: row.description ?? "",
		name: row.name ?? "",
	};
}

function selectLabelsWithCount(db: Db) {
	return db
		.select({
			label: labelsTable,
			sampleCount: count(legacySampleLabels.sample_id),
		})
		.from(labelsTable)
		.leftJoin(
			legacySampleLabels,
			eq(legacySampleLabels.label_id, labelsTable.id),
		)
		.groupBy(labelsTable.id)
		.$dynamic();
}

export async function findLabels(db: Db, term = ""): Promise<Label[]> {
	const rows = await selectLabelsWithCount(db)
		.where(term ? ilike(labelsTable.name, `%${term}%`) : undefined)
		.orderBy(asc(labelsTable.name));

	return rows.map((row) => toLabel(row.label, row.sampleCount));
}

export async function getLabel(db: Db, labelId: number): Promise<Label> {
	const [row] = await selectLabelsWithCount(db).where(
		eq(labelsTable.id, labelId),
	);

	if (!row) {
		throw new LabelNotFoundError();
	}

	return toLabel(row.label, row.sampleCount);
}

export async function createLabel(db: Db, values: LabelValues): Promise<Label> {
	let row: LabelRow;
	try {
		row = takeFirstOrThrow(
			await db.insert(labelsTable).values(values).returning(),
		);
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new LabelConflictError();
		}
		throw error;
	}

	await emit("labels", row.id, "create");

	return toLabel(row, 0);
}

export async function updateLabel(
	db: Db,
	labelId: number,
	values: Partial<LabelValues>,
): Promise<Label> {
	if (Object.keys(values).length === 0) {
		return getLabel(db, labelId);
	}

	let row: LabelRow | undefined;
	try {
		[row] = await db
			.update(labelsTable)
			.set(values)
			.where(eq(labelsTable.id, labelId))
			.returning();
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new LabelConflictError();
		}
		throw error;
	}

	if (!row) {
		throw new LabelNotFoundError();
	}

	await emit("labels", row.id, "update");

	return getLabel(db, row.id);
}

export async function deleteLabel(db: Db, labelId: number): Promise<void> {
	const [row] = await db
		.delete(labelsTable)
		.where(eq(labelsTable.id, labelId))
		.returning({ id: labelsTable.id });

	if (!row) {
		throw new LabelNotFoundError();
	}

	await emit("labels", row.id, "delete");
}
