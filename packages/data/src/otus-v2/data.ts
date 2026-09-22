import { randomUUID } from "node:crypto";
import {
	AllowLocalOtuAccessionCommand,
	type AllowLocalOtuAccessionCommandInput,
	CreateLocalOtuCommand,
	type CreateLocalOtuCommandInput,
	CreateLocalOtuIsolateCommand,
	type CreateLocalOtuIsolateCommandInput,
	DeleteLocalOtuCommand,
	type DeleteLocalOtuCommandInput,
	DeleteLocalOtuIsolateCommand,
	type DeleteLocalOtuIsolateCommandInput,
	ExcludeLocalOtuAccessionCommand,
	type ExcludeLocalOtuAccessionCommandInput,
	type LocalOtuV2,
	type LocalOtuV2AccessionExclusionPreview,
	type LocalOtuV2IsolateDetail,
	type LocalOtuV2IsolateSummary,
	type LocalOtuV2Overview,
	type LocalOtuV2PlanPreview,
	type LocalOtuV2Sequence,
	type LocalOtuV2SequencePreview,
	type LocalOtuV2SequenceSummary,
	type LocalOtuV2Summary,
	type OtuV2Change,
	type OtuV2Isolate,
	OtuV2IsolatePlan,
	PromoteLocalOtuIsolateCommand,
	type PromoteLocalOtuIsolateCommandInput,
	UpdateLocalOtuIsolateCommand,
	type UpdateLocalOtuIsolateCommandInput,
	UpdateLocalOtuPlanCommand,
	type UpdateLocalOtuPlanCommandInput,
	UpdateLocalOtuSequenceCommand,
	type UpdateLocalOtuSequenceCommandInput,
	UpdateLocalOtuTaxonomyCommand,
	type UpdateLocalOtuTaxonomyCommandInput,
} from "@virtool/contracts";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db, DbOrTx, Transaction } from "../db/pg";
import { takeFirst } from "../db/rows";
import {
	otuChanges,
	otuExcludedAccessionBases,
	otuIsolates,
	otuIsolateVersions,
	otuLocalIdentities,
	otuLocalIdentityRevisions,
	otuLocalSequenceRecords,
	otuPlanSegments,
	otuPlanSegmentVersions,
	otuPlans,
	otuPromotedAccessionBases,
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

/** Thrown when an accession base is excluded from an OTU. */
export class OtuV2ExcludedAccessionError extends AppError {}

/** Thrown when an accession was superseded by a promoted base. */
export class OtuV2PromotedAccessionError extends AppError {}

/** Thrown when an accession exclusion already exists. */
export class OtuV2AlreadyExcludedAccessionError extends AppError {}

/** Thrown when an accession exclusion does not exist. */
export class OtuV2AccessionNotExcludedError extends AppError {}

/** Thrown when GenBank provenance does not describe the submitted sequences. */
export class OtuV2InvalidProvenanceError extends AppError {}

/** Thrown when an OTU command is based on an outdated OTU version. */
export class OtuV2VersionConflictError extends AppError {}

/** Thrown when deletion would leave a v2 OTU without an isolate. */
export class OtuV2LastIsolateError extends AppError {}

/** Thrown when an isolate does not satisfy its OTU's current plan. */
export class OtuV2InvalidIsolateError extends AppError {}

/** Thrown when a proposed plan does not belong to the OTU. */
export class OtuV2InvalidPlanError extends AppError {}

function toOtuV2Change(row: {
	version: number;
	command:
		| "CreateOTU"
		| "CreateIsolate"
		| "UpdateTaxonomy"
		| "UpdatePlan"
		| "UpdateIsolate"
		| "UpdateSequence"
		| "PromoteIsolate"
		| "ExcludeAccession"
		| "AllowAccession"
		| "DeleteIsolate"
		| "DeleteOTU";
	commandSchemaVersion: number;
	otuName: string | null;
	isolateName: OtuV2Isolate["name"];
	segmentCount: number | null;
	sequenceSource: "manual" | "genbank" | null;
	sequenceAccessionVersion: string | null;
	previousSequenceSource: "manual" | "genbank" | null;
	previousSequenceAccessionVersion: string | null;
	accessionBase: string | null;
	retiredIsolate: { id: string; name: OtuV2Isolate["name"] } | null;
	promotionIsolateId: string | null;
	promotionAccessions: Array<{
		from: string;
		to: string;
		kind: "refresh" | "promotion";
	}> | null;
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
		case "UpdateIsolate":
			return { ...base, command: row.command, name: row.isolateName };
		case "UpdateTaxonomy":
			if (!row.otuName) {
				throw new Error("Missing name in taxonomy change.");
			}
			return { ...base, command: row.command, name: row.otuName };
		case "UpdatePlan":
			return {
				...base,
				command: row.command,
				segmentCount: row.segmentCount ?? 0,
			};
		case "UpdateSequence":
			if (!row.sequenceSource) {
				throw new Error("Missing source in sequence change.");
			}
			return {
				...base,
				command: row.command,
				sequenceSource: row.sequenceSource,
				accessionVersion: row.sequenceAccessionVersion,
				previousSource: row.previousSequenceSource ?? "manual",
				previousAccessionVersion: row.previousSequenceAccessionVersion,
			};
		case "PromoteIsolate":
			return {
				...base,
				command: row.command,
				isolateId: row.promotionIsolateId ?? "",
				accessions: row.promotionAccessions ?? [],
			};
		case "ExcludeAccession":
			if (!row.accessionBase) {
				throw new Error("Missing excluded accession base.");
			}
			return {
				...base,
				command: row.command,
				accessionBase: row.accessionBase,
				retiredIsolate: row.retiredIsolate,
			};
		case "AllowAccession":
			if (!row.accessionBase) {
				throw new Error("Missing allowed accession base.");
			}
			return {
				...base,
				command: row.command,
				accessionBase: row.accessionBase,
			};
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

/** Values needed to edit one isolate's name and name type. */
export type UpdateLocalOtuIsolateValues = {
	referenceId: string;
	userId: number;
	command: UpdateLocalOtuIsolateCommandInput;
};

/** Revise isolate metadata without changing any sequence or its provenance. */
export async function updateLocalOtuIsolate(
	db: Db,
	values: UpdateLocalOtuIsolateValues,
): Promise<LocalOtuV2> {
	const command = UpdateLocalOtuIsolateCommand.parse(values.command);
	return db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);
		const otu = await getLocalOtu(tx, values.referenceId, command.otuId);
		const isolate = otu.isolates.find(
			({ id }) => id === command.payload.isolateId,
		);
		if (!isolate) {
			throw new OtuV2NotFoundError();
		}
		if (!OtuV2IsolatePlan.safeParse({ plan: otu.plan, isolate }).success) {
			throw new OtuV2InvalidIsolateError();
		}
		const version = command.expectedVersion + 1;
		await tx
			.update(otuIsolateVersions)
			.set({ lastVersion: version })
			.where(
				and(
					eq(otuIsolateVersions.otuId, command.otuId),
					eq(otuIsolateVersions.isolateId, isolate.id),
					isNull(otuIsolateVersions.lastVersion),
				),
			);
		await tx.insert(otuIsolateVersions).values({
			id: randomUUID(),
			otuId: command.otuId,
			isolateId: isolate.id,
			nameType: command.payload.name?.type ?? null,
			nameValue: command.payload.name?.value ?? null,
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

function getSequenceImpact(
	otu: LocalOtuV2,
	old: LocalOtuV2Sequence,
	command: UpdateLocalOtuSequenceCommand,
): LocalOtuV2SequencePreview {
	const provenanceIssues: string[] = [];
	if (command.payload.source === "genbank") {
		if (old.source !== "genbank") {
			provenanceIssues.push(
				"Only an existing GenBank sequence can retain GenBank source.",
			);
		}
		if (old.accessionVersion !== command.payload.accessionVersion) {
			provenanceIssues.push(
				"The accession version no longer matches the current record.",
			);
		}
		if (old.sequence !== command.payload.sequence) {
			provenanceIssues.push(
				"Changed bases must use manual source and clear the accession.",
			);
		}
	}
	return {
		expectedVersion: otu.version,
		source: command.payload.source,
		accessionVersion: command.payload.accessionVersion,
		provenanceIssues,
		isolates: otu.isolates.map((isolate) => {
			const revised = {
				...isolate,
				sequences: isolate.sequences.map((sequence) =>
					sequence.id === command.payload.sequenceId
						? {
								id: sequence.id,
								definition: command.payload.definition,
								sequence: command.payload.sequence,
								segmentId: command.payload.segmentId,
							}
						: sequence,
				),
			};
			const result = OtuV2IsolatePlan.safeParse({
				plan: otu.plan,
				isolate: revised,
			});
			return {
				isolateId: isolate.id,
				name: isolate.name,
				issues: result.success
					? []
					: Array.from(
							new Set(result.error.issues.map((issue) => issue.message)),
						),
			};
		}),
	};
}

/** Preview source and all isolate impacts for a proposed sequence edit. */
export async function previewLocalOtuSequence(
	db: Db,
	referenceId: string,
	commandInput: UpdateLocalOtuSequenceCommandInput,
): Promise<LocalOtuV2SequencePreview> {
	const command = UpdateLocalOtuSequenceCommand.parse(commandInput);
	const reference = takeFirst(
		await db
			.select({ archived: referenceRoots.archived, kind: referenceRoots.kind })
			.from(referenceRoots)
			.where(eq(referenceRoots.id, referenceId)),
	);
	if (reference?.archived || reference?.kind !== "local") {
		throw new OtuV2ReferenceNotWritableError();
	}
	const otu = await getLocalOtu(db, referenceId, command.otuId);
	if (otu.version !== command.expectedVersion) {
		throw new OtuV2VersionConflictError();
	}
	const old = await getLocalOtuSequence(
		db,
		referenceId,
		command.otuId,
		command.payload.isolateId,
		command.payload.sequenceId,
	);
	return getSequenceImpact(otu, old, command);
}

/** Values needed to edit one sequence record. */
export type UpdateLocalOtuSequenceValues = {
	referenceId: string;
	userId: number;
	command: UpdateLocalOtuSequenceCommandInput;
};

/** Save a sequence edit only while every surviving isolate remains valid. */
export async function updateLocalOtuSequence(
	db: Db,
	values: UpdateLocalOtuSequenceValues,
): Promise<LocalOtuV2> {
	const command = UpdateLocalOtuSequenceCommand.parse(values.command);
	return db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);
		const otu = await getLocalOtu(tx, values.referenceId, command.otuId);
		const old = await getLocalOtuSequence(
			tx,
			values.referenceId,
			command.otuId,
			command.payload.isolateId,
			command.payload.sequenceId,
		);
		const impact = getSequenceImpact(otu, old, command);
		if (impact.provenanceIssues.length > 0) {
			throw new OtuV2InvalidProvenanceError();
		}
		if (impact.isolates.some((isolate) => isolate.issues.length > 0)) {
			throw new OtuV2InvalidIsolateError();
		}
		const version = command.expectedVersion + 1;
		const recordId = randomUUID();
		await tx.insert(otuLocalSequenceRecords).values({
			id: recordId,
			otuId: command.otuId,
			sequenceId: command.payload.sequenceId,
			definition: command.payload.definition,
			sequence: command.payload.sequence,
			source: command.payload.source,
			accessionVersion: command.payload.accessionVersion,
			createdAt: new Date(),
		});
		await tx
			.update(otuSequenceVersions)
			.set({ lastVersion: version })
			.where(
				and(
					eq(otuSequenceVersions.otuId, command.otuId),
					eq(otuSequenceVersions.sequenceId, command.payload.sequenceId),
					isNull(otuSequenceVersions.lastVersion),
				),
			);
		await tx.insert(otuSequenceVersions).values({
			id: randomUUID(),
			otuId: command.otuId,
			sequenceId: command.payload.sequenceId,
			isolateId: command.payload.isolateId,
			segmentId: command.payload.segmentId,
			localRecordId: recordId,
			firstVersion: version,
		});
		if (command.payload.source === "manual") {
			await tx
				.update(otuSequences)
				.set({ accessionBase: null })
				.where(eq(otuSequences.id, command.payload.sequenceId));
		}
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
			payload: {
				...command.payload,
				previousSource: old.source,
				previousAccessionVersion: old.accessionVersion,
			},
			source: "user",
			userId: values.userId,
			createdAt: new Date(),
		});
		return getLocalOtu(tx, values.referenceId, command.otuId);
	});
}

/** Values needed for an approved atomic GenBank isolate replacement. */
export type PromoteLocalOtuIsolateValues = {
	referenceId: string;
	userId: number;
	command: PromoteLocalOtuIsolateCommandInput;
};

/** Replace all of an isolate's GenBank records in one OTU version. */
export async function promoteLocalOtuIsolate(
	db: Db,
	values: PromoteLocalOtuIsolateValues,
): Promise<LocalOtuV2> {
	const command = PromoteLocalOtuIsolateCommand.parse(values.command);
	return db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);
		const otu = await getLocalOtu(tx, values.referenceId, command.otuId);
		const isolate = otu.isolates.find(
			(item) => item.id === command.payload.isolateId,
		);
		if (
			!isolate ||
			isolate.sequences.length !== command.payload.sequences.length
		) {
			throw new OtuV2InvalidProvenanceError();
		}
		const oldById = new Map(
			await Promise.all(
				isolate.sequences.map(
					async (sequence) =>
						[
							sequence.id,
							await getLocalOtuSequence(
								tx,
								values.referenceId,
								command.otuId,
								isolate.id,
								sequence.id,
							),
						] as const,
				),
			),
		);
		const oldBases = new Set<string>();
		const newBases = new Set<string>();
		const promotions: Array<{
			from: string;
			to: string;
			kind: "refresh" | "promotion";
		}> = [];
		const proposed = [];
		for (const entry of command.payload.sequences) {
			const old = oldById.get(entry.sequenceId);
			if (!old) {
				throw new OtuV2InvalidProvenanceError();
			}
			if (
				old.source !== "genbank" ||
				old.accessionVersion !== entry.previousAccessionVersion ||
				old.segmentId !== entry.segmentId
			) {
				throw new OtuV2InvalidProvenanceError();
			}
			const oldBase = getAccessionBase(old.accessionVersion);
			const newBase = getAccessionBase(entry.accessionVersion);
			if (oldBases.has(oldBase) || newBases.has(newBase)) {
				throw new OtuV2DuplicateAccessionError(newBase);
			}
			oldBases.add(oldBase);
			newBases.add(newBase);
			const changed = entry.accessionVersion !== old.accessionVersion;
			if (
				changed !== entry.approved ||
				(!changed &&
					(entry.sequence !== old.sequence ||
						entry.definition !== old.definition))
			) {
				throw new OtuV2InvalidProvenanceError();
			}
			if (changed) {
				if (
					newBase === oldBase &&
					Number(entry.accessionVersion.split(".").at(-1)) <=
						Number(old.accessionVersion.split(".").at(-1))
				) {
					throw new OtuV2InvalidProvenanceError();
				}
				promotions.push({
					from: old.accessionVersion,
					to: entry.accessionVersion,
					kind: oldBase === newBase ? "refresh" : "promotion",
				});
			}
			proposed.push({
				id: old.id,
				segmentId: entry.segmentId,
				definition: entry.definition,
				sequence: entry.sequence,
			});
		}
		if (
			promotions.length === 0 ||
			!OtuV2IsolatePlan.safeParse({
				plan: otu.plan,
				isolate: { ...isolate, sequences: proposed },
			}).success
		) {
			throw new OtuV2InvalidIsolateError();
		}
		if (
			promotions.some(
				(item) =>
					item.kind === "promotion" && oldBases.has(getAccessionBase(item.to)),
			)
		) {
			throw new OtuV2DuplicateAccessionError();
		}
		const excluded = await tx
			.select({ accessionBase: otuExcludedAccessionBases.accessionBase })
			.from(otuExcludedAccessionBases)
			.where(
				and(
					eq(otuExcludedAccessionBases.otuId, otu.id),
					inArray(otuExcludedAccessionBases.accessionBase, [...newBases]),
				),
			);
		if (excluded[0]) {
			throw new OtuV2ExcludedAccessionError(excluded[0].accessionBase);
		}
		const superseded = await tx
			.select({ accessionBase: otuPromotedAccessionBases.accessionBase })
			.from(otuPromotedAccessionBases)
			.where(
				and(
					eq(otuPromotedAccessionBases.otuId, otu.id),
					inArray(otuPromotedAccessionBases.accessionBase, [...newBases]),
				),
			);
		if (superseded[0]) {
			throw new OtuV2PromotedAccessionError(superseded[0].accessionBase);
		}
		const active = await tx
			.select({ accessionBase: otuSequences.accessionBase })
			.from(otuSequences)
			.where(
				and(
					eq(otuSequences.otuId, otu.id),
					isNull(otuSequences.retiredVersion),
					inArray(otuSequences.accessionBase, [...newBases]),
				),
			);
		if (
			active.some(
				(row) => row.accessionBase && !oldBases.has(row.accessionBase),
			)
		) {
			throw new OtuV2DuplicateAccessionError();
		}
		const version = otu.version + 1;
		for (const entry of command.payload.sequences) {
			if (!entry.approved) {
				continue;
			}
			const newBase = getAccessionBase(entry.accessionVersion);
			const oldBase = getAccessionBase(entry.previousAccessionVersion);
			const recordId = randomUUID();
			await tx.insert(otuLocalSequenceRecords).values({
				id: recordId,
				otuId: otu.id,
				sequenceId: entry.sequenceId,
				definition: entry.definition,
				sequence: entry.sequence,
				source: "genbank",
				accessionVersion: entry.accessionVersion,
				createdAt: new Date(),
			});
			await tx
				.update(otuSequenceVersions)
				.set({ lastVersion: version })
				.where(
					and(
						eq(otuSequenceVersions.otuId, otu.id),
						eq(otuSequenceVersions.sequenceId, entry.sequenceId),
						isNull(otuSequenceVersions.lastVersion),
					),
				);
			await tx.insert(otuSequenceVersions).values({
				id: randomUUID(),
				otuId: otu.id,
				sequenceId: entry.sequenceId,
				isolateId: isolate.id,
				segmentId: entry.segmentId,
				localRecordId: recordId,
				firstVersion: version,
			});
			if (oldBase !== newBase) {
				await tx
					.update(otuSequences)
					.set({ accessionBase: newBase })
					.where(eq(otuSequences.id, entry.sequenceId));
				await tx.insert(otuPromotedAccessionBases).values({
					otuId: otu.id,
					accessionBase: oldBase,
					promotedToBase: newBase,
					createdVersion: version,
				});
			}
		}
		await tx.update(otusV2).set({ version }).where(eq(otusV2.id, otu.id));
		await tx.insert(otuChanges).values({
			referenceId: values.referenceId,
			otuId: otu.id,
			version,
			command: command.type,
			commandSchemaVersion: command.schemaVersion,
			payload: { ...command.payload, accessions: promotions },
			source: "user",
			userId: values.userId,
			createdAt: new Date(),
		});
		return getLocalOtu(tx, values.referenceId, otu.id);
	});
}

/** Read a writable isolate and its exact active GenBank provenance for preview. */
export async function getLocalOtuPromotionSource(
	db: Db,
	referenceId: string,
	otuId: string,
	isolateId: string,
	expectedVersion: number,
): Promise<{
	otu: LocalOtuV2;
	sequences: LocalOtuV2Sequence[];
	activeAccessions: Array<{ sequenceId: string; accessionBase: string | null }>;
}> {
	const reference = takeFirst(
		await db
			.select({ archived: referenceRoots.archived, kind: referenceRoots.kind })
			.from(referenceRoots)
			.where(eq(referenceRoots.id, referenceId)),
	);
	if (!reference || reference.archived || reference.kind !== "local") {
		throw new OtuV2ReferenceNotWritableError();
	}
	const otu = await getLocalOtu(db, referenceId, otuId);
	if (otu.version !== expectedVersion) {
		throw new OtuV2VersionConflictError();
	}
	const isolate = otu.isolates.find((item) => item.id === isolateId);
	if (!isolate) {
		throw new OtuV2NotFoundError();
	}
	const [sequences, activeAccessions] = await Promise.all([
		Promise.all(
			isolate.sequences.map((sequence) =>
				getLocalOtuSequence(db, referenceId, otuId, isolateId, sequence.id),
			),
		),
		db
			.select({
				sequenceId: otuSequences.id,
				accessionBase: otuSequences.accessionBase,
			})
			.from(otuSequences)
			.where(
				and(eq(otuSequences.otuId, otuId), isNull(otuSequences.retiredVersion)),
			),
	]);
	return { otu, sequences, activeAccessions };
}

async function getCurrentIsolateCount(
	tx: DbOrTx,
	otuId: string,
): Promise<number> {
	const row = takeFirst(
		await tx
			.select({ value: count() })
			.from(otuIsolateVersions)
			.where(
				and(
					eq(otuIsolateVersions.otuId, otuId),
					isNull(otuIsolateVersions.lastVersion),
				),
			),
	);
	return Number(row?.value ?? 0);
}

async function retireIsolate(
	tx: Transaction,
	otuId: string,
	isolateId: string,
	version: number,
): Promise<void> {
	const isolate = takeFirst(
		await tx
			.select({ id: otuIsolateVersions.id })
			.from(otuIsolateVersions)
			.where(
				and(
					eq(otuIsolateVersions.otuId, otuId),
					eq(otuIsolateVersions.isolateId, isolateId),
					isNull(otuIsolateVersions.lastVersion),
				),
			),
	);
	if (!isolate) {
		throw new OtuV2NotFoundError();
	}
	if ((await getCurrentIsolateCount(tx, otuId)) <= 1) {
		throw new OtuV2LastIsolateError();
	}
	const sequenceIds = await tx
		.select({ id: otuSequenceVersions.sequenceId })
		.from(otuSequenceVersions)
		.where(
			and(
				eq(otuSequenceVersions.otuId, otuId),
				eq(otuSequenceVersions.isolateId, isolateId),
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
					eq(otuSequenceVersions.otuId, otuId),
					eq(otuSequenceVersions.isolateId, isolateId),
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
}

async function getActiveAccessionIsolate(
	db: DbOrTx,
	otuId: string,
	accessionBase: string,
): Promise<{ id: string; name: OtuV2Isolate["name"] } | null> {
	const row = takeFirst(
		await db
			.select({
				id: otuIsolateVersions.isolateId,
				nameType: otuIsolateVersions.nameType,
				nameValue: otuIsolateVersions.nameValue,
			})
			.from(otuSequences)
			.innerJoin(
				otuSequenceVersions,
				eq(otuSequences.id, otuSequenceVersions.sequenceId),
			)
			.innerJoin(
				otuIsolateVersions,
				eq(otuSequenceVersions.isolateId, otuIsolateVersions.isolateId),
			)
			.where(
				and(
					eq(otuSequences.otuId, otuId),
					eq(otuSequences.accessionBase, accessionBase),
					isNull(otuSequences.retiredVersion),
					isNull(otuSequenceVersions.lastVersion),
					isNull(otuIsolateVersions.lastVersion),
				),
			),
	);
	return row
		? {
				id: row.id,
				name:
					row.nameType && row.nameValue
						? { type: row.nameType, value: row.nameValue }
						: null,
			}
		: null;
}

/** Preview the isolate retirement caused by excluding an accession base. */
export async function previewExcludeLocalOtuAccession(
	db: Db,
	referenceId: string,
	commandInput: ExcludeLocalOtuAccessionCommandInput,
): Promise<LocalOtuV2AccessionExclusionPreview> {
	const command = ExcludeLocalOtuAccessionCommand.parse(commandInput);
	const reference = takeFirst(
		await db
			.select({ archived: referenceRoots.archived, kind: referenceRoots.kind })
			.from(referenceRoots)
			.where(eq(referenceRoots.id, referenceId)),
	);
	if (reference?.archived || reference?.kind !== "local") {
		throw new OtuV2ReferenceNotWritableError();
	}
	const otu = await getLocalOtu(db, referenceId, command.otuId);
	if (otu.version !== command.expectedVersion) {
		throw new OtuV2VersionConflictError();
	}
	if (otu.excludedAccessionBases.includes(command.payload.accessionBase)) {
		throw new OtuV2AlreadyExcludedAccessionError(command.payload.accessionBase);
	}
	if (
		otu.promotedAccessionBases.some(
			(item) => item.accessionBase === command.payload.accessionBase,
		)
	) {
		throw new OtuV2PromotedAccessionError(command.payload.accessionBase);
	}
	const retiredIsolate = await getActiveAccessionIsolate(
		db,
		command.otuId,
		command.payload.accessionBase,
	);
	return {
		expectedVersion: otu.version,
		accessionBase: command.payload.accessionBase,
		retiredIsolate,
		canExclude: !retiredIsolate || otu.isolates.length > 1,
	};
}

/** Values needed to exclude an accession base. */
export type ExcludeLocalOtuAccessionValues = {
	referenceId: string;
	userId: number;
	command: ExcludeLocalOtuAccessionCommandInput;
};

/** Exclude a base and retire its entire active isolate in one OTU version. */
export async function excludeLocalOtuAccession(
	db: Db,
	values: ExcludeLocalOtuAccessionValues,
): Promise<LocalOtuV2> {
	const command = ExcludeLocalOtuAccessionCommand.parse(values.command);
	return db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);
		const existing = takeFirst(
			await tx
				.select({ accessionBase: otuExcludedAccessionBases.accessionBase })
				.from(otuExcludedAccessionBases)
				.where(
					and(
						eq(otuExcludedAccessionBases.otuId, command.otuId),
						eq(
							otuExcludedAccessionBases.accessionBase,
							command.payload.accessionBase,
						),
					),
				),
		);
		if (existing) {
			throw new OtuV2AlreadyExcludedAccessionError(
				command.payload.accessionBase,
			);
		}
		const promoted = takeFirst(
			await tx
				.select({ accessionBase: otuPromotedAccessionBases.accessionBase })
				.from(otuPromotedAccessionBases)
				.where(
					and(
						eq(otuPromotedAccessionBases.otuId, command.otuId),
						eq(
							otuPromotedAccessionBases.accessionBase,
							command.payload.accessionBase,
						),
					),
				),
		);
		if (promoted) {
			throw new OtuV2PromotedAccessionError(command.payload.accessionBase);
		}
		const version = command.expectedVersion + 1;
		const retiredIsolate = await getActiveAccessionIsolate(
			tx,
			command.otuId,
			command.payload.accessionBase,
		);
		if (retiredIsolate) {
			await retireIsolate(tx, command.otuId, retiredIsolate.id, version);
		}
		await tx.insert(otuExcludedAccessionBases).values({
			otuId: command.otuId,
			accessionBase: command.payload.accessionBase,
			createdVersion: version,
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
			payload: { ...command.payload, retiredIsolate },
			source: "user",
			userId: values.userId,
			createdAt: new Date(),
		});
		return getLocalOtu(tx, values.referenceId, command.otuId);
	});
}

/** Values needed to allow an excluded accession base. */
export type AllowLocalOtuAccessionValues = {
	referenceId: string;
	userId: number;
	command: AllowLocalOtuAccessionCommandInput;
};

/** Allow future imports of a base without restoring retired isolates. */
export async function allowLocalOtuAccession(
	db: Db,
	values: AllowLocalOtuAccessionValues,
): Promise<LocalOtuV2> {
	const command = AllowLocalOtuAccessionCommand.parse(values.command);
	return db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);
		const deleted = await tx
			.delete(otuExcludedAccessionBases)
			.where(
				and(
					eq(otuExcludedAccessionBases.otuId, command.otuId),
					eq(
						otuExcludedAccessionBases.accessionBase,
						command.payload.accessionBase,
					),
				),
			)
			.returning({ accessionBase: otuExcludedAccessionBases.accessionBase });
		if (deleted.length === 0) {
			throw new OtuV2AccessionNotExcludedError(command.payload.accessionBase);
		}
		const version = command.expectedVersion + 1;
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

		const version = command.expectedVersion + 1;
		await retireIsolate(tx, command.otuId, command.payload.isolateId, version);
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

function getPlanImpact(
	otu: LocalOtuV2,
	command: UpdateLocalOtuPlanCommand,
): LocalOtuV2PlanPreview {
	if (otu.plan.id !== command.payload.plan.id) {
		throw new OtuV2InvalidPlanError();
	}
	return {
		expectedVersion: otu.version,
		molecule: command.payload.molecule,
		plan: command.payload.plan,
		isolates: otu.isolates.map((isolate) => {
			const result = OtuV2IsolatePlan.safeParse({
				plan: command.payload.plan,
				isolate,
			});
			return {
				isolateId: isolate.id,
				name: isolate.name,
				issues: result.success
					? []
					: Array.from(
							new Set(result.error.issues.map((issue) => issue.message)),
						),
			};
		}),
	};
}

/** Preview all surviving isolates against a proposed molecule and plan. */
export async function previewLocalOtuPlan(
	db: Db,
	referenceId: string,
	commandInput: UpdateLocalOtuPlanCommandInput,
): Promise<LocalOtuV2PlanPreview> {
	const command = UpdateLocalOtuPlanCommand.parse(commandInput);
	const reference = takeFirst(
		await db
			.select({ archived: referenceRoots.archived, kind: referenceRoots.kind })
			.from(referenceRoots)
			.where(eq(referenceRoots.id, referenceId)),
	);
	if (reference?.archived || reference?.kind !== "local") {
		throw new OtuV2ReferenceNotWritableError();
	}
	const otu = await getLocalOtu(db, referenceId, command.otuId);
	if (otu.version !== command.expectedVersion) {
		throw new OtuV2VersionConflictError();
	}
	return getPlanImpact(otu, command);
}

/** Values needed to edit a local OTU's molecule and segment plan. */
export type UpdateLocalOtuPlanValues = {
	referenceId: string;
	userId: number;
	command: UpdateLocalOtuPlanCommandInput;
};

/** Apply a proposed plan only if every surviving isolate still satisfies it. */
export async function updateLocalOtuPlan(
	db: Db,
	values: UpdateLocalOtuPlanValues,
): Promise<LocalOtuV2> {
	const command = UpdateLocalOtuPlanCommand.parse(values.command);
	return db.transaction(async (tx) => {
		await getWritableLocalOtu(
			tx,
			values.referenceId,
			command.otuId,
			command.expectedVersion,
		);
		const otu = await getLocalOtu(tx, values.referenceId, command.otuId);
		const impact = getPlanImpact(otu, command);
		if (impact.isolates.some((isolate) => isolate.issues.length > 0)) {
			throw new OtuV2InvalidIsolateError();
		}
		const version = command.expectedVersion + 1;
		const oldIds = new Set(
			(
				await tx
					.select({ id: otuPlanSegments.id })
					.from(otuPlanSegments)
					.where(eq(otuPlanSegments.otuId, command.otuId))
			).map((segment) => segment.id),
		);
		const newSegments = command.payload.plan.segments.filter(
			(segment) => !oldIds.has(segment.id),
		);
		if (newSegments.length > 0) {
			await tx.insert(otuPlanSegments).values(
				newSegments.map((segment) => ({
					id: segment.id,
					otuId: command.otuId,
					planId: otu.plan.id,
				})),
			);
		}
		await tx
			.update(otuPlanSegmentVersions)
			.set({ lastVersion: version })
			.where(
				and(
					eq(otuPlanSegmentVersions.otuId, command.otuId),
					isNull(otuPlanSegmentVersions.lastVersion),
				),
			);
		await tx.insert(otuPlanSegmentVersions).values(
			command.payload.plan.segments.map((segment) => ({
				id: randomUUID(),
				otuId: command.otuId,
				segmentId: segment.id,
				namePrefix: segment.name?.prefix ?? null,
				nameKey: segment.name?.key ?? null,
				length: segment.length,
				lengthTolerance: segment.lengthTolerance,
				rule: segment.rule,
				firstVersion: version,
			})),
		);
		await tx
			.update(otusV2)
			.set({
				version,
				moleculeType: command.payload.molecule.type,
				moleculeStrandedness: command.payload.molecule.strandedness,
				moleculeTopology: command.payload.molecule.topology,
			})
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
	const excluded = await tx
		.select({ accessionBase: otuExcludedAccessionBases.accessionBase })
		.from(otuExcludedAccessionBases)
		.where(
			and(
				eq(otuExcludedAccessionBases.otuId, otuId),
				inArray(otuExcludedAccessionBases.accessionBase, accessionBases),
			),
		);
	if (excluded[0]?.accessionBase) {
		throw new OtuV2ExcludedAccessionError(excluded[0].accessionBase);
	}
	const promoted = await tx
		.select({ accessionBase: otuPromotedAccessionBases.accessionBase })
		.from(otuPromotedAccessionBases)
		.where(
			and(
				eq(otuPromotedAccessionBases.otuId, otuId),
				inArray(otuPromotedAccessionBases.accessionBase, accessionBases),
			),
		);
	if (promoted[0]?.accessionBase) {
		throw new OtuV2PromotedAccessionError(promoted[0].accessionBase);
	}
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

	const [taxonomyRows, planRows, changeRows, excludedRows, promotedRows] =
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
					version: otuChanges.version,
					command: otuChanges.command,
					commandSchemaVersion: otuChanges.commandSchemaVersion,
					otuName: sql<
						string | null
					>`coalesce(${otuChanges.payload}->'taxonomy'->>'name', ${otuChanges.payload}->>'name')`,
					isolateName: sql<
						OtuV2Isolate["name"]
					>`coalesce(${otuChanges.payload}->'isolate'->'name', ${otuChanges.payload}->'name')`,
					segmentCount: sql<
						number | null
					>`jsonb_array_length(${otuChanges.payload}->'plan'->'segments')`,
					sequenceSource: sql<
						"manual" | "genbank" | null
					>`${otuChanges.payload}->>'source'`,
					sequenceAccessionVersion: sql<
						string | null
					>`${otuChanges.payload}->>'accessionVersion'`,
					previousSequenceSource: sql<
						"manual" | "genbank" | null
					>`${otuChanges.payload}->>'previousSource'`,
					previousSequenceAccessionVersion: sql<
						string | null
					>`${otuChanges.payload}->>'previousAccessionVersion'`,
					accessionBase: sql<
						string | null
					>`${otuChanges.payload}->>'accessionBase'`,
					retiredIsolate: sql<{
						id: string;
						name: OtuV2Isolate["name"];
					} | null>`${otuChanges.payload}->'retiredIsolate'`,
					promotionIsolateId: sql<
						string | null
					>`${otuChanges.payload}->>'isolateId'`,
					promotionAccessions: sql<Array<{
						from: string;
						to: string;
						kind: "refresh" | "promotion";
					}> | null>`${otuChanges.payload}->'accessions'`,
					createdAt: otuChanges.createdAt,
					userId: users.id,
					userHandle: users.handle,
				})
				.from(otuChanges)
				.innerJoin(users, eq(otuChanges.userId, users.id))
				.where(eq(otuChanges.otuId, otuId))
				.orderBy(desc(otuChanges.version)),
			db
				.select({ accessionBase: otuExcludedAccessionBases.accessionBase })
				.from(otuExcludedAccessionBases)
				.where(eq(otuExcludedAccessionBases.otuId, otuId))
				.orderBy(asc(otuExcludedAccessionBases.accessionBase)),
			db
				.select({
					accessionBase: otuPromotedAccessionBases.accessionBase,
					promotedToBase: otuPromotedAccessionBases.promotedToBase,
				})
				.from(otuPromotedAccessionBases)
				.where(eq(otuPromotedAccessionBases.otuId, otuId))
				.orderBy(asc(otuPromotedAccessionBases.accessionBase)),
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
		excludedAccessionBases: excludedRows.map((row) => row.accessionBase),
		promotedAccessionBases: promotedRows,
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

	const [
		taxonomyRows,
		planRows,
		isolateRows,
		sequenceRows,
		changeRows,
		excludedRows,
		promotedRows,
	] = await Promise.all([
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
				>`coalesce(${otuChanges.payload}->'isolate'->'name', ${otuChanges.payload}->'name')`,
				segmentCount: sql<
					number | null
				>`jsonb_array_length(${otuChanges.payload}->'plan'->'segments')`,
				sequenceSource: sql<
					"manual" | "genbank" | null
				>`${otuChanges.payload}->>'source'`,
				sequenceAccessionVersion: sql<
					string | null
				>`${otuChanges.payload}->>'accessionVersion'`,
				previousSequenceSource: sql<
					"manual" | "genbank" | null
				>`${otuChanges.payload}->>'previousSource'`,
				previousSequenceAccessionVersion: sql<
					string | null
				>`${otuChanges.payload}->>'previousAccessionVersion'`,
				accessionBase: sql<
					string | null
				>`${otuChanges.payload}->>'accessionBase'`,
				retiredIsolate: sql<{
					id: string;
					name: OtuV2Isolate["name"];
				} | null>`${otuChanges.payload}->'retiredIsolate'`,
				promotionIsolateId: sql<
					string | null
				>`${otuChanges.payload}->>'isolateId'`,
				promotionAccessions: sql<Array<{
					from: string;
					to: string;
					kind: "refresh" | "promotion";
				}> | null>`${otuChanges.payload}->'accessions'`,
				createdAt: otuChanges.createdAt,
				userId: users.id,
				userHandle: users.handle,
			})
			.from(otuChanges)
			.innerJoin(users, eq(otuChanges.userId, users.id))
			.where(eq(otuChanges.otuId, otuId))
			.orderBy(desc(otuChanges.version)),
		db
			.select({ accessionBase: otuExcludedAccessionBases.accessionBase })
			.from(otuExcludedAccessionBases)
			.where(eq(otuExcludedAccessionBases.otuId, otuId))
			.orderBy(asc(otuExcludedAccessionBases.accessionBase)),
		db
			.select({
				accessionBase: otuPromotedAccessionBases.accessionBase,
				promotedToBase: otuPromotedAccessionBases.promotedToBase,
			})
			.from(otuPromotedAccessionBases)
			.where(eq(otuPromotedAccessionBases.otuId, otuId))
			.orderBy(asc(otuPromotedAccessionBases.accessionBase)),
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
		excludedAccessionBases: excludedRows.map((row) => row.accessionBase),
		promotedAccessionBases: promotedRows,
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
