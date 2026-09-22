import { randomUUID } from "node:crypto";
import {
	CreateLocalOtuCommand,
	type CreateLocalOtuCommandInput,
	CreateLocalOtuIsolateCommand,
	type CreateLocalOtuIsolateCommandInput,
	DeleteLocalOtuCommand,
	type DeleteLocalOtuCommandInput,
	DeleteLocalOtuIsolateCommand,
	type DeleteLocalOtuIsolateCommandInput,
	type LocalOtuV2,
	type LocalOtuV2IsolateDetail,
	type LocalOtuV2IsolateSummary,
	type LocalOtuV2Overview,
	type LocalOtuV2Sequence,
	type LocalOtuV2SequenceSummary,
	type LocalOtuV2Summary,
	type OtuV2Change,
	type OtuV2Isolate,
	OtuV2IsolatePlan,
	UpdateLocalOtuTaxonomyCommand,
	type UpdateLocalOtuTaxonomyCommandInput,
} from "@virtool/contracts";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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

/** Thrown when an accession is already active in an OTU. */
export class OtuV2DuplicateAccessionError extends AppError {}

/** Thrown when GenBank provenance does not describe the submitted sequences. */
export class OtuV2InvalidProvenanceError extends AppError {}

/** Thrown when an OTU command is based on an outdated OTU version. */
export class OtuV2VersionConflictError extends AppError {}

/** Thrown when deletion would leave a v2 OTU without an isolate. */
export class OtuV2LastIsolateError extends AppError {}

/** Thrown when an isolate does not satisfy its OTU's current plan. */
export class OtuV2InvalidIsolateError extends AppError {}

function toOtuV2Change(row: {
	version: number;
	command:
		| "CreateOTU"
		| "CreateIsolate"
		| "UpdateTaxonomy"
		| "DeleteIsolate"
		| "DeleteOTU";
	commandSchemaVersion: number;
	otuName: string | null;
	isolateName: OtuV2Isolate["name"];
	createdAt: Date;
	userId: number;
	userHandle: string;
}): OtuV2Change {
	const base = {
		version: row.version,
		commandSchemaVersion: row.commandSchemaVersion,
		source: "user" as const,
		user: { id: row.userId, handle: row.userHandle },
		createdAt: row.createdAt,
	};

	switch (row.command) {
		case "CreateOTU":
			return { ...base, command: row.command, name: row.otuName };
		case "CreateIsolate":
			return { ...base, command: row.command, name: row.isolateName };
		case "UpdateTaxonomy":
			if (!row.otuName) {
				throw new Error("Missing name in taxonomy change.");
			}
			return { ...base, command: row.command, name: row.otuName };
		case "DeleteIsolate":
		case "DeleteOTU":
			return { ...base, command: row.command };
	}
}

async function getWritableLocalOtu(
	tx: Transaction,
	referenceId: string,
	otuId: string,
	expectedVersion: number,
): Promise<void> {
	const otu = takeFirst(
		await tx
			.select({
				version: otusV2.version,
				deletedVersion: otusV2.deletedVersion,
				archived: referenceRoots.archived,
				kind: referenceRoots.kind,
			})
			.from(otusV2)
			.innerJoin(referenceRoots, eq(referenceRoots.id, otusV2.referenceId))
			.where(and(eq(otusV2.id, otuId), eq(otusV2.referenceId, referenceId)))
			.for("update"),
	);
	if (!otu || otu.deletedVersion !== null) {
		throw new OtuV2NotFoundError();
	}
	if (otu.archived || otu.kind !== "local") {
		throw new OtuV2ReferenceNotWritableError();
	}
	if (otu.version !== expectedVersion) {
		throw new OtuV2VersionConflictError();
	}
}

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
		if (isUniqueViolation(error, "otu_sequences_current_accession_key")) {
			throw new OtuV2DuplicateAccessionError();
		}
		if (isUniqueViolation(error)) {
			throw new OtuV2ConflictError();
		}
		throw error;
	}

	return getLocalOtu(db, values.referenceId, command.otuId);
}

/** Values needed to add one isolate to a local OTU. */
export type CreateLocalOtuIsolateValues = {
	referenceId: string;
	userId: number;
	command: CreateLocalOtuIsolateCommandInput;
};

/** Values needed to edit a local OTU's taxonomy identity. */
export type UpdateLocalOtuTaxonomyValues = {
	referenceId: string;
	userId: number;
	command: UpdateLocalOtuTaxonomyCommandInput;
};

/** Apply a versioned taxonomy edit without changing sequence provenance. */
export async function updateLocalOtuTaxonomy(
	db: Db,
	values: UpdateLocalOtuTaxonomyValues,
): Promise<LocalOtuV2> {
	const command = UpdateLocalOtuTaxonomyCommand.parse(values.command);
	return db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);
		const current = takeFirst(
			await tx
				.select({
					versionId: otuTaxonomyVersions.id,
					identityId: otuLocalIdentityRevisions.identityId,
				})
				.from(otuTaxonomyVersions)
				.innerJoin(
					otuLocalIdentityRevisions,
					eq(
						otuTaxonomyVersions.localIdentityRevisionId,
						otuLocalIdentityRevisions.id,
					),
				)
				.where(
					and(
						eq(otuTaxonomyVersions.otuId, command.otuId),
						eq(otuTaxonomyVersions.kind, "local"),
						isNull(otuTaxonomyVersions.lastVersion),
					),
				),
		);
		if (!current) {
			throw new OtuV2NotFoundError();
		}
		const version = command.expectedVersion + 1;
		const revisionId = randomUUID();
		await tx.insert(otuLocalIdentityRevisions).values({
			id: revisionId,
			referenceId: values.referenceId,
			otuId: command.otuId,
			identityId: current.identityId,
			name: command.payload.name,
			acronym: command.payload.acronym,
			lineage: command.payload.lineage,
			createdAt: new Date(),
		});
		await tx
			.update(otuTaxonomyVersions)
			.set({ lastVersion: version })
			.where(eq(otuTaxonomyVersions.id, current.versionId));
		await tx.insert(otuTaxonomyVersions).values({
			id: randomUUID(),
			referenceId: values.referenceId,
			otuId: command.otuId,
			kind: "local",
			localIdentityRevisionId: revisionId,
			firstVersion: version,
		});
		await tx
			.update(otusV2)
			.set({ version })
			.where(eq(otusV2.id, command.otuId));
		await tx.insert(otuChanges).values({
			referenceId: values.referenceId,
			otuId: command.otuId,
			version,
			command: command.type,
			commandSchemaVersion: command.schemaVersion,
			payload: command.payload,
			source: "user",
			userId: values.userId,
			createdAt: new Date(),
		});
		return getLocalOtu(tx, values.referenceId, command.otuId);
	});
}

/** Values needed to delete a local OTU. */
export type DeleteLocalOtuValues = {
	referenceId: string;
	userId: number;
	command: DeleteLocalOtuCommandInput;
};

/** Values needed to delete one isolate from a local OTU. */
export type DeleteLocalOtuIsolateValues = {
	referenceId: string;
	userId: number;
	command: DeleteLocalOtuIsolateCommandInput;
};

/** Soft-delete one local isolate and its sequences at the expected version. */
export async function deleteLocalOtuIsolate(
	db: Db,
	values: DeleteLocalOtuIsolateValues,
): Promise<LocalOtuV2> {
	const command = DeleteLocalOtuIsolateCommand.parse(values.command);

	await db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);

		const isolate = takeFirst(
			await tx
				.select({ id: otuIsolateVersions.id })
				.from(otuIsolateVersions)
				.where(
					and(
						eq(otuIsolateVersions.otuId, command.otuId),
						eq(otuIsolateVersions.isolateId, command.payload.isolateId),
						isNull(otuIsolateVersions.lastVersion),
					),
				),
		);
		if (!isolate) {
			throw new OtuV2NotFoundError();
		}
		const isolateCount = takeFirst(
			await tx
				.select({ value: count() })
				.from(otuIsolateVersions)
				.where(
					and(
						eq(otuIsolateVersions.otuId, command.otuId),
						isNull(otuIsolateVersions.lastVersion),
					),
				),
		);
		if (Number(isolateCount?.value ?? 0) <= 1) {
			throw new OtuV2LastIsolateError();
		}

		const version = command.expectedVersion + 1;
		const sequenceIds = await tx
			.select({ id: otuSequenceVersions.sequenceId })
			.from(otuSequenceVersions)
			.where(
				and(
					eq(otuSequenceVersions.otuId, command.otuId),
					eq(otuSequenceVersions.isolateId, command.payload.isolateId),
					isNull(otuSequenceVersions.lastVersion),
				),
			);
		await Promise.all([
			tx
				.update(otuIsolateVersions)
				.set({ lastVersion: version })
				.where(eq(otuIsolateVersions.id, isolate.id)),
			tx
				.update(otuSequenceVersions)
				.set({ lastVersion: version })
				.where(
					and(
						eq(otuSequenceVersions.otuId, command.otuId),
						eq(otuSequenceVersions.isolateId, command.payload.isolateId),
						isNull(otuSequenceVersions.lastVersion),
					),
				),
		]);
		await tx
			.update(otuSequences)
			.set({ retiredVersion: version })
			.where(
				inArray(
					otuSequences.id,
					sequenceIds.map((row) => row.id),
				),
			);
		await tx
			.update(otusV2)
			.set({ version })
			.where(eq(otusV2.id, command.otuId));
		await tx.insert(otuChanges).values({
			referenceId: values.referenceId,
			otuId: command.otuId,
			version,
			command: command.type,
			commandSchemaVersion: command.schemaVersion,
			payload: command.payload,
			source: "user",
			userId: values.userId,
			createdAt: new Date(),
		});
	});

	return getLocalOtu(db, values.referenceId, command.otuId);
}

/** Soft-delete one local OTU atomically at the expected version. */
export async function deleteLocalOtu(
	db: Db,
	values: DeleteLocalOtuValues,
): Promise<void> {
	const command = DeleteLocalOtuCommand.parse(values.command);

	await db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);

		const version = command.expectedVersion + 1;
		await tx
			.update(otusV2)
			.set({ version, deletedVersion: version })
			.where(eq(otusV2.id, command.otuId));
		await tx.insert(otuChanges).values({
			referenceId: values.referenceId,
			otuId: command.otuId,
			version,
			command: command.type,
			commandSchemaVersion: command.schemaVersion,
			payload: command.payload,
			source: "user",
			userId: values.userId,
			createdAt: new Date(),
		});
	});
}

/** Add one isolate to a local OTU atomically at the expected version. */
export async function createLocalOtuIsolate(
	db: Db,
	values: CreateLocalOtuIsolateValues,
): Promise<LocalOtuV2> {
	const command = CreateLocalOtuIsolateCommand.parse(values.command);

	try {
		await db.transaction(async (tx) => {
			await getWritableLocalOtu(
				tx,
				values.referenceId,
				command.otuId,
				command.expectedVersion,
			);
			const segmentRows = await tx
				.select({
					id: otuPlanSegmentVersions.segmentId,
					namePrefix: otuPlanSegmentVersions.namePrefix,
					nameKey: otuPlanSegmentVersions.nameKey,
					length: otuPlanSegmentVersions.length,
					lengthTolerance: otuPlanSegmentVersions.lengthTolerance,
					rule: otuPlanSegmentVersions.rule,
				})
				.from(otuPlanSegmentVersions)
				.where(
					and(
						eq(otuPlanSegmentVersions.otuId, command.otuId),
						isNull(otuPlanSegmentVersions.lastVersion),
					),
				);
			const plan = takeFirst(
				await tx
					.select({ id: otuPlans.id })
					.from(otuPlans)
					.where(eq(otuPlans.otuId, command.otuId)),
			);
			if (
				!plan ||
				!OtuV2IsolatePlan.safeParse({
					plan: {
						id: plan.id,
						segments: segmentRows.map((segment) => ({
							id: segment.id,
							name:
								segment.namePrefix && segment.nameKey
									? { prefix: segment.namePrefix, key: segment.nameKey }
									: null,
							length: segment.length,
							lengthTolerance: segment.lengthTolerance,
							rule: segment.rule,
						})),
					},
					isolate: command.payload.isolate,
				}).success
			) {
				throw new OtuV2InvalidIsolateError();
			}

			const version = command.expectedVersion + 1;
			await insertIsolate(
				tx,
				command.otuId,
				command.payload.isolate,
				command.payload.genbank,
				version,
			);
			await tx
				.update(otusV2)
				.set({ version })
				.where(eq(otusV2.id, command.otuId));
			await tx.insert(otuChanges).values({
				referenceId: values.referenceId,
				otuId: command.otuId,
				version,
				command: command.type,
				commandSchemaVersion: command.schemaVersion,
				payload: command.payload,
				source: "user",
				userId: values.userId,
				createdAt: new Date(),
			});
		});
	} catch (error) {
		if (isUniqueViolation(error, "otu_sequences_current_accession_key")) {
			throw new OtuV2DuplicateAccessionError();
		}
		if (isUniqueViolation(error)) {
			throw new OtuV2ConflictError();
		}
		throw error;
	}

	return getLocalOtu(db, values.referenceId, command.otuId);
}

async function insertIsolate(
	tx: Transaction,
	otuId: string,
	isolate: CreateLocalOtuIsolateCommand["payload"]["isolate"],
	genbank: CreateLocalOtuIsolateCommand["payload"]["genbank"],
	version: number,
): Promise<void> {
	const now = new Date();
	const provenance = await getSequenceProvenance(tx, otuId, isolate, genbank);
	await tx.insert(otuIsolates).values({ id: isolate.id, otuId });
	await tx.insert(otuIsolateVersions).values({
		id: randomUUID(),
		otuId,
		isolateId: isolate.id,
		nameType: isolate.name?.type ?? null,
		nameValue: isolate.name?.value ?? null,
		firstVersion: version,
	});

	const entries = isolate.sequences.map((sequence) => ({
		sequence,
		recordId: randomUUID(),
		accessionVersion: provenance.get(sequence.id) ?? null,
	}));
	await tx.insert(otuSequences).values(
		entries.map(({ sequence, accessionVersion }) => ({
			id: sequence.id,
			otuId,
			accessionBase: accessionVersion
				? getAccessionBase(accessionVersion)
				: null,
		})),
	);
	await tx.insert(otuLocalSequenceRecords).values(
		entries.map(({ sequence, recordId, accessionVersion }) => ({
			id: recordId,
			otuId,
			sequenceId: sequence.id,
			definition: sequence.definition,
			sequence: sequence.sequence,
			source: accessionVersion ? ("genbank" as const) : ("manual" as const),
			accessionVersion,
			createdAt: now,
		})),
	);
	await tx.insert(otuSequenceVersions).values(
		entries.map(({ sequence, recordId }) => ({
			id: randomUUID(),
			otuId,
			sequenceId: sequence.id,
			isolateId: isolate.id,
			segmentId: sequence.segmentId,
			localRecordId: recordId,
			firstVersion: version,
		})),
	);
}

function getAccessionBase(accessionVersion: string): string {
	const match = /^([A-Za-z0-9_-]+)\.[1-9][0-9]*$/.exec(accessionVersion);
	if (!match?.[1]) {
		throw new OtuV2InvalidProvenanceError();
	}
	return match[1].toUpperCase();
}

async function getSequenceProvenance(
	tx: Transaction,
	otuId: string,
	isolate: CreateLocalOtuIsolateCommand["payload"]["isolate"],
	genbank: CreateLocalOtuIsolateCommand["payload"]["genbank"],
): Promise<Map<string, string>> {
	if (!genbank) {
		return new Map();
	}

	const sequenceIds = new Set(isolate.sequences.map((sequence) => sequence.id));
	const bySequenceId = new Map<string, string>();
	const byAccessionBase = new Map<string, string>();
	for (const { sequenceId, accession } of genbank.sequences) {
		if (!sequenceIds.has(sequenceId) || bySequenceId.has(sequenceId)) {
			throw new OtuV2InvalidProvenanceError();
		}
		const accessionBase = getAccessionBase(accession);
		if (byAccessionBase.has(accessionBase)) {
			throw new OtuV2DuplicateAccessionError(accessionBase);
		}
		bySequenceId.set(sequenceId, accession);
		byAccessionBase.set(accessionBase, accession);
	}
	if (bySequenceId.size !== sequenceIds.size) {
		throw new OtuV2InvalidProvenanceError();
	}

	const accessionBases = [...byAccessionBase.keys()];
	const existing = await tx
		.select({ accessionBase: otuSequences.accessionBase })
		.from(otuSequences)
		.where(
			and(
				eq(otuSequences.otuId, otuId),
				isNull(otuSequences.retiredVersion),
				inArray(otuSequences.accessionBase, accessionBases),
			),
		);
	if (existing[0]?.accessionBase) {
		throw new OtuV2DuplicateAccessionError(existing[0].accessionBase);
	}
	return bySequenceId;
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

	await insertIsolate(tx, command.otuId, payload.isolate, payload.genbank, 1);

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

/** Read the current local v2 OTU metadata without isolates or sequences. */
async function getLocalOtuMetadata(
	db: DbOrTx,
	referenceId: string,
	otuId: string,
): Promise<Omit<LocalOtuV2, "isolates">> {
	const otu = takeFirst(
		await db
			.select()
			.from(otusV2)
			.where(and(eq(otusV2.referenceId, referenceId), eq(otusV2.id, otuId))),
	);

	if (!otu || otu.ncbiFromVersion !== null || otu.deletedVersion !== null) {
		throw new OtuV2NotFoundError();
	}

	const [taxonomyRows, planRows, changeRows] = await Promise.all([
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
				version: otuChanges.version,
				command: otuChanges.command,
				commandSchemaVersion: otuChanges.commandSchemaVersion,
				otuName: sql<
					string | null
				>`coalesce(${otuChanges.payload}->'taxonomy'->>'name', ${otuChanges.payload}->>'name')`,
				isolateName: sql<
					OtuV2Isolate["name"]
				>`${otuChanges.payload}->'isolate'->'name'`,
				createdAt: otuChanges.createdAt,
				userId: users.id,
				userHandle: users.handle,
			})
			.from(otuChanges)
			.innerJoin(users, eq(otuChanges.userId, users.id))
			.where(eq(otuChanges.otuId, otuId))
			.orderBy(desc(otuChanges.version)),
	]);

	const taxonomy = takeFirst(taxonomyRows);
	const change = takeFirst(changeRows);
	const firstPlanRow = takeFirst(planRows);
	if (!taxonomy || !change || !firstPlanRow) {
		throw new OtuV2NotFoundError();
	}

	return {
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
			id: firstPlanRow.planId,
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
		createdAt: otu.createdAt,
		changes: changeRows.map(toOtuV2Change),
		mostRecentChange: toOtuV2Change(change),
	};
}

async function assertLocalOtuExists(
	db: DbOrTx,
	referenceId: string,
	otuId: string,
): Promise<void> {
	const row = takeFirst(
		await db
			.select({ id: otusV2.id })
			.from(otusV2)
			.where(
				and(
					eq(otusV2.referenceId, referenceId),
					eq(otusV2.id, otuId),
					isNull(otusV2.ncbiFromVersion),
					isNull(otusV2.deletedVersion),
				),
			),
	);

	if (!row) {
		throw new OtuV2NotFoundError();
	}
}

/** Read the local v2 OTU overview without sequence bodies. */
export async function getLocalOtuOverview(
	db: DbOrTx,
	referenceId: string,
	otuId: string,
): Promise<LocalOtuV2Overview> {
	const [metadata, isolateRows, countRows] = await Promise.all([
		getLocalOtuMetadata(db, referenceId, otuId),
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
			)
			.orderBy(asc(otuIsolates.id))
			.limit(5),
		db
			.select({ count: count(otuIsolates.id) })
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
	]);

	return {
		...metadata,
		isolates: isolateRows.map((isolate) => ({
			id: isolate.id,
			name:
				isolate.nameType && isolate.nameValue
					? { type: isolate.nameType, value: isolate.nameValue }
					: null,
		})),
		isolateCount: Number(countRows[0]?.count ?? 0),
	};
}

/** Read all current isolates in a local v2 OTU without sequences. */
export async function getLocalOtuIsolates(
	db: DbOrTx,
	referenceId: string,
	otuId: string,
): Promise<LocalOtuV2IsolateSummary[]> {
	await assertLocalOtuExists(db, referenceId, otuId);
	const [rows, creationChanges] = await Promise.all([
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
			)
			.orderBy(asc(otuIsolates.id)),
		db
			.select({
				payload: otuChanges.payload,
				createdAt: otuChanges.createdAt,
			})
			.from(otuChanges)
			.where(
				and(
					eq(otuChanges.otuId, otuId),
					inArray(otuChanges.command, ["CreateOTU", "CreateIsolate"]),
				),
			),
	]);
	const createdAtByIsolateId = new Map(
		creationChanges.map((change) => [
			(change.payload as { isolate: { id: string } }).isolate.id,
			change.createdAt,
		]),
	);

	return rows.map((isolate) => {
		const createdAt = createdAtByIsolateId.get(isolate.id);
		if (!createdAt) {
			throw new Error(`Missing creation change for isolate ${isolate.id}`);
		}

		return {
			id: isolate.id,
			name:
				isolate.nameType && isolate.nameValue
					? { type: isolate.nameType, value: isolate.nameValue }
					: null,
			createdAt,
		};
	});
}

/** Read one current isolate and its sequence metadata without sequence bodies. */
export async function getLocalOtuIsolate(
	db: DbOrTx,
	referenceId: string,
	otuId: string,
	isolateId: string,
): Promise<LocalOtuV2IsolateDetail> {
	await assertLocalOtuExists(db, referenceId, otuId);
	const [isolate, sequences] = await Promise.all([
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
					eq(otuIsolates.id, isolateId),
					eq(otuIsolates.otuId, otuId),
					isNull(otuIsolateVersions.lastVersion),
				),
			),
		db
			.select({
				id: otuSequences.id,
				definition: otuLocalSequenceRecords.definition,
				segmentId: otuSequenceVersions.segmentId,
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
					eq(otuSequenceVersions.isolateId, isolateId),
					isNull(otuSequenceVersions.lastVersion),
				),
			),
	]);

	const row = takeFirst(isolate);
	if (!row) {
		throw new OtuV2NotFoundError();
	}

	return {
		id: row.id,
		name:
			row.nameType && row.nameValue
				? { type: row.nameType, value: row.nameValue }
				: null,
		sequences: sequences as LocalOtuV2SequenceSummary[],
	};
}

/** Read one local v2 sequence body after validating its full ownership path. */
export async function getLocalOtuSequence(
	db: DbOrTx,
	referenceId: string,
	otuId: string,
	isolateId: string,
	sequenceId: string,
): Promise<LocalOtuV2Sequence> {
	await assertLocalOtuExists(db, referenceId, otuId);
	const row = takeFirst(
		await db
			.select({
				id: otuSequences.id,
				definition: otuLocalSequenceRecords.definition,
				sequence: otuLocalSequenceRecords.sequence,
				source: otuLocalSequenceRecords.source,
				accessionVersion: otuLocalSequenceRecords.accessionVersion,
				segmentId: otuSequenceVersions.segmentId,
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
					eq(otuSequences.id, sequenceId),
					eq(otuSequences.otuId, otuId),
					eq(otuSequenceVersions.isolateId, isolateId),
					isNull(otuSequenceVersions.lastVersion),
				),
			),
	);

	if (!row) {
		throw new OtuV2NotFoundError();
	}

	return row;
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
					otuName: sql<
						string | null
					>`coalesce(${otuChanges.payload}->'taxonomy'->>'name', ${otuChanges.payload}->>'name')`,
					isolateName: sql<
						OtuV2Isolate["name"]
					>`${otuChanges.payload}->'isolate'->'name'`,
					createdAt: otuChanges.createdAt,
					userId: users.id,
					userHandle: users.handle,
				})
				.from(otuChanges)
				.innerJoin(users, eq(otuChanges.userId, users.id))
				.where(eq(otuChanges.otuId, otuId))
				.orderBy(desc(otuChanges.version)),
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
		changes: changeRows.map(toOtuV2Change),
		mostRecentChange: toOtuV2Change(change),
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

function isUniqueViolation(error: unknown, constraint?: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	if ("code" in error && error.code === "23505") {
		return (
			constraint === undefined ||
			("constraint_name" in error && error.constraint_name === constraint) ||
			("constraint" in error && error.constraint === constraint)
		);
	}

	return "cause" in error && isUniqueViolation(error.cause, constraint);
}
