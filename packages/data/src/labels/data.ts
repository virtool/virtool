import { DEFAULT_LABEL_COLOR } from "@virtool/contracts";
import { asc, eq, ilike } from "drizzle-orm";
import type { PostgresError } from "postgres";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { type LabelRow, labels as labelsTable } from "../db/schema/labels";
import { AppError } from "../errors";
import { emit } from "../events/emit";

/** A sample label with the count expected by the label-management UI. */
export type Label = {
	id: number;
	color: string;
	count: number;
	description: string;
	name: string;
};

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

function toLabel(row: LabelRow): Label {
	return {
		id: row.id,
		color: normalizeColor(row.color),
		// Stubbed to 0 until the sample-label join is wired into the TS
		// server; the count would come from legacy_sample_labels.
		count: 0,
		description: row.description ?? "",
		name: row.name ?? "",
	};
}

export async function findLabels(db: Db, term = ""): Promise<Label[]> {
	const rows = await db
		.select()
		.from(labelsTable)
		.where(term ? ilike(labelsTable.name, `%${term}%`) : undefined)
		.orderBy(asc(labelsTable.name));

	return rows.map((row) => toLabel(row));
}

export async function getLabel(db: Db, labelId: number): Promise<Label> {
	const [row] = await db
		.select()
		.from(labelsTable)
		.where(eq(labelsTable.id, labelId));

	if (!row) {
		throw new LabelNotFoundError();
	}

	return toLabel(row);
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

	return toLabel(row);
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

	return toLabel(row);
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
