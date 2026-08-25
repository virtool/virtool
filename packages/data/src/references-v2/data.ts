import { randomUUID } from "node:crypto";
import type { ReferenceV2, ReferenceV2CreateRequest } from "@virtool/contracts";
import { eq } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirst, takeFirstOrThrow } from "../db/rows";
import {
	type ReferenceRootRow,
	referenceRoots,
	referenceUsers,
} from "../db/schema/referencesV2";
import { AppError } from "../errors";

/** Thrown when a v2 Reference does not exist. */
export class ReferenceV2NotFoundError extends AppError {}

/** Values needed to create a local v2 Reference. */
export type CreateReferenceV2Values = ReferenceV2CreateRequest & {
	userId: number;
};

function mapReference(row: ReferenceRootRow): ReferenceV2 {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		kind: row.kind,
		defaultSegmentLengthTolerance: row.defaultSegmentLengthTolerance,
		archived: row.archived,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/** Create a local v2 Reference and grant its creator all Reference rights. */
export async function createReferenceV2(
	db: Db,
	values: CreateReferenceV2Values,
): Promise<ReferenceV2> {
	return db.transaction(async (tx) => {
		const now = new Date();
		const reference = takeFirstOrThrow(
			await tx
				.insert(referenceRoots)
				.values({
					id: randomUUID(),
					name: values.name,
					description: values.description,
					kind: "local",
					defaultSegmentLengthTolerance: values.defaultSegmentLengthTolerance,
					archived: false,
					createdAt: now,
					updatedAt: now,
				})
				.returning(),
		);

		await tx.insert(referenceUsers).values({
			referenceId: reference.id,
			userId: values.userId,
			build: true,
			modify: true,
			modifyOtu: true,
		});

		return mapReference(reference);
	});
}

/** Get a v2 Reference by id. */
export async function getReferenceV2(
	db: DbOrTx,
	referenceId: string,
): Promise<ReferenceV2> {
	const row = takeFirst(
		await db
			.select()
			.from(referenceRoots)
			.where(eq(referenceRoots.id, referenceId)),
	);

	if (!row) {
		throw new ReferenceV2NotFoundError();
	}

	return mapReference(row);
}
