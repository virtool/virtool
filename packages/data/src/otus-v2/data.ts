import { randomUUID } from "node:crypto";
import {
	CreateLocalOtuCommand,
	type CreateLocalOtuCommandInput,
	type LocalOtuV2,
	type LocalOtuV2Summary,
} from "@virtool/contracts";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import type { Db, DbOrTx, Transaction } from "../db/pg";
import { takeFirst } from "../db/rows";
import {
	otuChanges,
	otuIsolates,
	otuIsolateVersions,
	otuLocalIdentities,
	otuLocalIdentityRevisions,
	otuLocalSequenceRecords,
	otuPlanSegments,
	otuPlanSegmentVersions,
	otuPlans,
	otuSequences,
	otuSequenceVersions,
	otusV2,
	otuTaxonomyVersions,
} from "../db/schema/otusV2";
import { referenceRoots } from "../db/schema/referencesV2";
import { users } from "../db/schema/users";
import { AppError } from "../errors";

/** Thrown when a v2 OTU does not exist in the requested Reference. */
export class OtuV2NotFoundError extends AppError {}

/** Thrown when a v2 OTU command targets a Reference that cannot be edited. */
export class OtuV2ReferenceNotWritableError extends AppError {}

/** Thrown when a v2 OTU command conflicts with existing identity. */
export class OtuV2ConflictError extends AppError {}

/** Values needed to apply a user-authored local `CreateOTU` command. */
export type CreateLocalOtuValues = {
	referenceId: string;
	userId: number;
	command: CreateLocalOtuCommandInput;
};

/** Apply one complete local `CreateOTU` command atomically. */
export async function createLocalOtu(
	db: Db,
	values: CreateLocalOtuValues,
): Promise<LocalOtuV2> {
	const command = CreateLocalOtuCommand.parse(values.command);

	try {
		await db.transaction(async (tx) => {
			const reference = takeFirst(
				await tx
					.select({
						archived: referenceRoots.archived,
						kind: referenceRoots.kind,
					})
					.from(referenceRoots)
					.where(eq(referenceRoots.id, values.referenceId))
					.for("update"),
			);

			if (!reference) {
				throw new OtuV2NotFoundError();
			}

			if (reference.archived || reference.kind !== "local") {
				throw new OtuV2ReferenceNotWritableError();
			}

			await insertLocalOtu(tx, values.referenceId, values.userId, command);
		});
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new OtuV2ConflictError();
		}
		throw error;
	}

	return getLocalOtu(db, values.referenceId, command.otuId);
}

async function insertLocalOtu(
	tx: Transaction,
	referenceId: string,
	userId: number,
	command: CreateLocalOtuCommand,
): Promise<void> {
	const { payload } = command;
	const now = new Date();
	const identityRevisionId = randomUUID();

	await tx.insert(otusV2).values({
		id: command.otuId,
		referenceId,
		moleculeType: payload.molecule.type,
		moleculeStrandedness: payload.molecule.strandedness,
		moleculeTopology: payload.molecule.topology,
		version: 1,
		createdAt: now,
	});

	await tx.insert(otuLocalIdentities).values({
		id: payload.taxonomy.identityId,
		referenceId,
		otuId: command.otuId,
		createdAt: now,
	});
	await tx.insert(otuLocalIdentityRevisions).values({
		id: identityRevisionId,
		referenceId,
		otuId: command.otuId,
		identityId: payload.taxonomy.identityId,
		name: payload.taxonomy.name,
		acronym: payload.taxonomy.acronym,
		lineage: payload.taxonomy.lineage,
		createdAt: now,
	});
	await tx.insert(otuTaxonomyVersions).values({
		id: randomUUID(),
		referenceId,
		otuId: command.otuId,
		kind: "local",
		localIdentityRevisionId: identityRevisionId,
		firstVersion: 1,
	});

	await tx.insert(otuPlans).values({
		id: payload.plan.id,
		otuId: command.otuId,
	});
	await tx.insert(otuPlanSegments).values(
		payload.plan.segments.map((segment) => ({
			id: segment.id,
			otuId: command.otuId,
			planId: payload.plan.id,
		})),
	);
	await tx.insert(otuPlanSegmentVersions).values(
		payload.plan.segments.map((segment) => ({
			id: randomUUID(),
			otuId: command.otuId,
			segmentId: segment.id,
			namePrefix: segment.name?.prefix ?? null,
			nameKey: segment.name?.key ?? null,
			length: segment.length,
			lengthTolerance: segment.lengthTolerance,
			rule: segment.rule,
			firstVersion: 1,
		})),
	);

	await tx.insert(otuIsolates).values({
		id: payload.isolate.id,
		otuId: command.otuId,
	});
	await tx.insert(otuIsolateVersions).values({
		id: randomUUID(),
		otuId: command.otuId,
		isolateId: payload.isolate.id,
		nameType: payload.isolate.name?.type ?? null,
		nameValue: payload.isolate.name?.value ?? null,
		firstVersion: 1,
	});

	const sequenceEntries = payload.isolate.sequences.map((sequence) => ({
		sequence,
		recordId: randomUUID(),
	}));

	await tx.insert(otuSequences).values(
		sequenceEntries.map(({ sequence }) => ({
			id: sequence.id,
			otuId: command.otuId,
		})),
	);
	await tx.insert(otuLocalSequenceRecords).values(
		sequenceEntries.map(({ sequence, recordId }) => ({
			id: recordId,
			otuId: command.otuId,
			sequenceId: sequence.id,
			definition: sequence.definition,
			sequence: sequence.sequence,
			createdAt: now,
		})),
	);
	await tx.insert(otuSequenceVersions).values(
		sequenceEntries.map(({ sequence, recordId }) => ({
			id: randomUUID(),
			otuId: command.otuId,
			sequenceId: sequence.id,
			isolateId: payload.isolate.id,
			segmentId: sequence.segmentId,
			localRecordId: recordId,
			firstVersion: 1,
		})),
	);

	await tx.insert(otuChanges).values({
		referenceId,
		otuId: command.otuId,
		version: 1,
		command: command.type,
		commandSchemaVersion: command.schemaVersion,
		payload,
		source: "user",
		userId,
		createdAt: now,
	});
}

/** Summarize the current local v2 OTUs in a Reference, ordered by name. */
export async function getLocalOtus(
	db: Db,
	referenceId: string,
): Promise<LocalOtuV2Summary[]> {
	const rows = await db
		.select({
			id: otusV2.id,
			version: otusV2.version,
			name: otuLocalIdentityRevisions.name,
			acronym: otuLocalIdentityRevisions.acronym,
		})
		.from(otusV2)
		.innerJoin(otuTaxonomyVersions, eq(otuTaxonomyVersions.otuId, otusV2.id))
		.innerJoin(
			otuLocalIdentityRevisions,
			eq(
				otuTaxonomyVersions.localIdentityRevisionId,
				otuLocalIdentityRevisions.id,
			),
		)
		.where(
			and(
				eq(otusV2.referenceId, referenceId),
				isNull(otusV2.ncbiFromVersion),
				isNull(otusV2.deletedVersion),
				eq(otuTaxonomyVersions.kind, "local"),
				isNull(otuTaxonomyVersions.lastVersion),
			),
		)
		.orderBy(asc(otuLocalIdentityRevisions.name), asc(otusV2.id));

	if (rows.length === 0) {
		return [];
	}

	const isolateCountRows = await db
		.select({ otuId: otuIsolates.otuId, isolateCount: count() })
		.from(otuIsolates)
		.innerJoin(
			otuIsolateVersions,
			eq(otuIsolates.id, otuIsolateVersions.isolateId),
		)
		.where(
			and(
				inArray(
					otuIsolates.otuId,
					rows.map((row) => row.id),
				),
				isNull(otuIsolateVersions.lastVersion),
			),
		)
		.groupBy(otuIsolates.otuId);

	const isolateCounts = new Map(
		isolateCountRows.map((row) => [row.otuId, row.isolateCount]),
	);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		acronym: row.acronym,
		version: row.version,
		isolateCount: isolateCounts.get(row.id) ?? 0,
	}));
}

/** Assemble a complete current local v2 OTU from relational state. */
export async function getLocalOtu(
	db: DbOrTx,
	referenceId: string,
	otuId: string,
): Promise<LocalOtuV2> {
	const otu = takeFirst(
		await db
			.select()
			.from(otusV2)
			.where(and(eq(otusV2.referenceId, referenceId), eq(otusV2.id, otuId))),
	);

	if (!otu || otu.ncbiFromVersion !== null || otu.deletedVersion !== null) {
		throw new OtuV2NotFoundError();
	}

	const [taxonomyRows, planRows, isolateRows, sequenceRows, changeRows] =
		await Promise.all([
			db
				.select({
					identityId: otuLocalIdentities.id,
					name: otuLocalIdentityRevisions.name,
					acronym: otuLocalIdentityRevisions.acronym,
					lineage: otuLocalIdentityRevisions.lineage,
				})
				.from(otuTaxonomyVersions)
				.innerJoin(
					otuLocalIdentityRevisions,
					eq(
						otuTaxonomyVersions.localIdentityRevisionId,
						otuLocalIdentityRevisions.id,
					),
				)
				.innerJoin(
					otuLocalIdentities,
					eq(otuLocalIdentityRevisions.identityId, otuLocalIdentities.id),
				)
				.where(
					and(
						eq(otuTaxonomyVersions.otuId, otuId),
						eq(otuTaxonomyVersions.kind, "local"),
						isNull(otuTaxonomyVersions.lastVersion),
					),
				),
			db
				.select({
					planId: otuPlans.id,
					segmentId: otuPlanSegments.id,
					namePrefix: otuPlanSegmentVersions.namePrefix,
					nameKey: otuPlanSegmentVersions.nameKey,
					length: otuPlanSegmentVersions.length,
					lengthTolerance: otuPlanSegmentVersions.lengthTolerance,
					rule: otuPlanSegmentVersions.rule,
				})
				.from(otuPlans)
				.innerJoin(otuPlanSegments, eq(otuPlans.id, otuPlanSegments.planId))
				.innerJoin(
					otuPlanSegmentVersions,
					eq(otuPlanSegments.id, otuPlanSegmentVersions.segmentId),
				)
				.where(
					and(
						eq(otuPlans.otuId, otuId),
						isNull(otuPlanSegmentVersions.lastVersion),
					),
				)
				.orderBy(asc(otuPlanSegmentVersions.id)),
			db
				.select({
					id: otuIsolates.id,
					nameType: otuIsolateVersions.nameType,
					nameValue: otuIsolateVersions.nameValue,
				})
				.from(otuIsolates)
				.innerJoin(
					otuIsolateVersions,
					eq(otuIsolates.id, otuIsolateVersions.isolateId),
				)
				.where(
					and(
						eq(otuIsolates.otuId, otuId),
						isNull(otuIsolateVersions.lastVersion),
					),
				),
			db
				.select({
					id: otuSequences.id,
					isolateId: otuSequenceVersions.isolateId,
					segmentId: otuSequenceVersions.segmentId,
					definition: otuLocalSequenceRecords.definition,
					sequence: otuLocalSequenceRecords.sequence,
				})
				.from(otuSequences)
				.innerJoin(
					otuSequenceVersions,
					eq(otuSequences.id, otuSequenceVersions.sequenceId),
				)
				.innerJoin(
					otuLocalSequenceRecords,
					eq(otuSequenceVersions.localRecordId, otuLocalSequenceRecords.id),
				)
				.where(
					and(
						eq(otuSequences.otuId, otuId),
						isNull(otuSequenceVersions.lastVersion),
					),
				),
			db
				.select({
					version: otuChanges.version,
					command: otuChanges.command,
					commandSchemaVersion: otuChanges.commandSchemaVersion,
					createdAt: otuChanges.createdAt,
					userId: users.id,
					userHandle: users.handle,
				})
				.from(otuChanges)
				.innerJoin(users, eq(otuChanges.userId, users.id))
				.where(
					and(eq(otuChanges.otuId, otuId), eq(otuChanges.version, otu.version)),
				),
		]);

	const taxonomy = takeFirst(taxonomyRows);
	const change = takeFirst(changeRows);
	const firstPlanRow = takeFirst(planRows);
	if (!taxonomy || !change || !firstPlanRow || isolateRows.length === 0) {
		throw new OtuV2NotFoundError();
	}

	const planId = firstPlanRow.planId;
	const isolates = isolateRows.map((isolate) => ({
		id: isolate.id,
		name:
			isolate.nameType && isolate.nameValue
				? { type: isolate.nameType, value: isolate.nameValue }
				: null,
		sequences: sequenceRows
			.filter((sequence) => sequence.isolateId === isolate.id)
			.map(({ isolateId: _isolateId, ...sequence }) => sequence),
	}));

	const assembled: LocalOtuV2 = {
		id: otu.id,
		referenceId: otu.referenceId,
		version: otu.version,
		molecule: {
			type: otu.moleculeType,
			strandedness: otu.moleculeStrandedness,
			topology: otu.moleculeTopology,
		},
		taxonomy: {
			kind: "local",
			identityId: taxonomy.identityId,
			name: taxonomy.name,
			acronym: taxonomy.acronym,
			lineage: taxonomy.lineage ?? [],
		},
		plan: {
			id: planId,
			segments: planRows.map((segment) => ({
				id: segment.segmentId,
				name:
					segment.namePrefix && segment.nameKey
						? { prefix: segment.namePrefix, key: segment.nameKey }
						: null,
				length: segment.length,
				lengthTolerance: segment.lengthTolerance,
				rule: segment.rule,
			})),
		},
		isolates,
		createdAt: otu.createdAt,
		mostRecentChange: {
			version: change.version,
			command: change.command,
			commandSchemaVersion: change.commandSchemaVersion,
			source: "user",
			user: { id: change.userId, handle: change.userHandle },
			createdAt: change.createdAt,
		},
	};

	CreateLocalOtuCommand.parse({
		type: "CreateOTU",
		schemaVersion: 1,
		otuId: assembled.id,
		expectedVersion: 0,
		payload: {
			molecule: assembled.molecule,
			plan: assembled.plan,
			taxonomy: assembled.taxonomy,
			promotedAccessions: [],
			isolate: assembled.isolates[0],
		},
	});

	return assembled;
}

function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	if ("code" in error && error.code === "23505") {
		return true;
	}

	return "cause" in error && isUniqueViolation(error.cause);
}
