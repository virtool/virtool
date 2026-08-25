import { randomUUID } from "node:crypto";
import type {
	ReferenceRight,
	ReferenceV2,
	ReferenceV2CreateRequest,
} from "@virtool/contracts";
import { and, eq, inArray } from "drizzle-orm";
import type { Db, DbOrTx } from "../db/pg";
import { takeFirst, takeFirstOrThrow } from "../db/rows";
import {
	type ReferenceRootRow,
	referenceGroups,
	referenceRoots,
	referenceUsers,
} from "../db/schema/referencesV2";
import { AppError } from "../errors";
import type { ReferenceActor } from "../references/data";

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

/**
 * Whether `actor` holds `right` on a v2 Reference. A full administrator holds
 * every right; otherwise a user membership row or any of the caller's group
 * membership rows with the flag set grants it — additively, either can grant.
 *
 * Throws {@link ReferenceV2NotFoundError} for a non-administrator when the
 * Reference does not exist, so a caller with no rights cannot tell a missing
 * Reference from one they may not touch.
 */
export async function checkReferenceV2Right(
	db: Db,
	referenceId: string,
	right: ReferenceRight,
	actor: ReferenceActor,
): Promise<boolean> {
	if (actor.isAdmin) {
		return true;
	}

	const [reference] = await db
		.select({ id: referenceRoots.id })
		.from(referenceRoots)
		.where(eq(referenceRoots.id, referenceId))
		.limit(1);

	if (!reference) {
		throw new ReferenceV2NotFoundError();
	}

	const userColumn =
		right === "build"
			? referenceUsers.build
			: right === "modify"
				? referenceUsers.modify
				: referenceUsers.modifyOtu;

	const [userRow] = await db
		.select({ userId: referenceUsers.userId })
		.from(referenceUsers)
		.where(
			and(
				eq(referenceUsers.referenceId, referenceId),
				eq(referenceUsers.userId, actor.userId),
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
				? referenceGroups.build
				: right === "modify"
					? referenceGroups.modify
					: referenceGroups.modifyOtu;

		const [groupRow] = await db
			.select({ referenceId: referenceGroups.referenceId })
			.from(referenceGroups)
			.where(
				and(
					eq(referenceGroups.referenceId, referenceId),
					inArray(referenceGroups.groupId, actor.groupIds),
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
 * Whether `actor` may see a v2 Reference at all. A full administrator sees every
 * Reference; otherwise any user or group membership row grants visibility,
 * regardless of the rights flags on that row. A v2 Reference has no separate
 * owner column — its creator is a full-rights member row.
 *
 * Returns `false` for both a missing Reference and one the actor cannot see, so
 * the caller can collapse the two into an indistinguishable 404.
 */
export async function checkReferenceV2Visibility(
	db: Db,
	referenceId: string,
	actor: ReferenceActor,
): Promise<boolean> {
	if (actor.isAdmin) {
		return true;
	}

	const [userRow] = await db
		.select({ userId: referenceUsers.userId })
		.from(referenceUsers)
		.where(
			and(
				eq(referenceUsers.referenceId, referenceId),
				eq(referenceUsers.userId, actor.userId),
			),
		)
		.limit(1);

	if (userRow) {
		return true;
	}

	if (actor.groupIds.length > 0) {
		const [groupRow] = await db
			.select({ referenceId: referenceGroups.referenceId })
			.from(referenceGroups)
			.where(
				and(
					eq(referenceGroups.referenceId, referenceId),
					inArray(referenceGroups.groupId, actor.groupIds),
				),
			)
			.limit(1);

		if (groupRow) {
			return true;
		}
	}

	return false;
}
