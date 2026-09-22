import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { otuChanges, otuSequences, otusV2 } from "../db/schema/otusV2";
import { referenceRoots, referenceUsers } from "../db/schema/referencesV2";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createReferenceV2,
	deleteReferenceV2,
	getReferenceV2,
	ReferenceV2NotFoundError,
} from "../references-v2/data";
import {
	allowLocalOtuAccession,
	createLocalOtu,
	createLocalOtuIsolate,
	deleteLocalOtuIsolate,
	excludeLocalOtuAccession,
	getLocalOtu,
	getLocalOtuIsolate,
	getLocalOtuOverview,
	getLocalOtuSequence,
	getLocalOtus,
	OtuV2AccessionNotExcludedError,
	OtuV2AlreadyExcludedAccessionError,
	OtuV2ConflictError,
	OtuV2DuplicateAccessionError,
	OtuV2ExcludedAccessionError,
	OtuV2InvalidIsolateError,
	OtuV2InvalidProvenanceError,
	OtuV2LastIsolateError,
	OtuV2NotFoundError,
	OtuV2PromotedAccessionError,
	OtuV2ReferenceNotWritableError,
	OtuV2VersionConflictError,
	previewExcludeLocalOtuAccession,
	previewLocalOtuPlan,
	previewLocalOtuSequence,
	promoteLocalOtuIsolate,
	updateLocalOtuIsolate,
	updateLocalOtuPlan,
	updateLocalOtuSequence,
	updateLocalOtuTaxonomy,
} from "./data";

const IDS = {
	otu: "10000000-0000-4000-8000-000000000001",
	identity: "10000000-0000-4000-8000-000000000002",
	plan: "10000000-0000-4000-8000-000000000003",
	segment: "10000000-0000-4000-8000-000000000004",
	isolate: "10000000-0000-4000-8000-000000000005",
	sequence: "10000000-0000-4000-8000-000000000006",
};

let database: TestDatabase;
let db: Db;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	userId = await seedUser(db);
}, 60_000);

afterAll(async () => {
	await database.drop();
});

function createCommand(otuId = IDS.otu) {
	const prefix = otuId.slice(0, -1);
	const identityId = `${prefix}2`;
	const planId = `${prefix}3`;
	const segmentId = `${prefix}4`;
	const isolateId = `${prefix}5`;
	const sequenceId = `${prefix}6`;

	return {
		type: "CreateOTU" as const,
		schemaVersion: 1 as const,
		otuId,
		expectedVersion: 0 as const,
		payload: {
			molecule: {
				type: "RNA" as const,
				strandedness: "single" as const,
				topology: "linear" as const,
			},
			plan: {
				id: planId,
				segments: [
					{
						id: segmentId,
						name: null,
						length: 8,
						lengthTolerance: 0,
						rule: "required" as const,
					},
				],
			},
			taxonomy: {
				kind: "local" as const,
				identityId,
				name: "Novel virus",
				acronym: "NV",
				lineage: [
					{ id: 10239, name: "Viruses", rank: "superkingdom" },
					{ id: 3044, name: "Novel virus", rank: "species" },
				],
			},
			promotedAccessions: [],
			isolate: {
				id: isolateId,
				name: { type: "isolate" as const, value: "Lab 1" },
				sequences: [
					{
						id: sequenceId,
						definition: "Complete genome",
						sequence: "atcg nnry",
						segmentId,
					},
				],
			},
		},
	};
}

async function createReference() {
	return createReferenceV2(db, {
		name: "Local reference",
		description: "",
		defaultSegmentLengthTolerance: 0.05,
		userId,
	});
}

describe("createReferenceV2", () => {
	it("creates the root and grants all rights to its creator", async () => {
		const reference = await createReference();
		const [membership] = await db
			.select()
			.from(referenceUsers)
			.where(eq(referenceUsers.referenceId, reference.id));

		expect(reference).toMatchObject({
			name: "Local reference",
			kind: "local",
			archived: false,
		});
		expect(membership).toEqual({
			referenceId: reference.id,
			userId,
			publishVersion: true,
			modify: true,
			modifyOtu: true,
		});
	});

	it("deletes a Reference and its complete OTU graph", async () => {
		const reference = await createReference();
		const otuId = "80000000-0000-4000-8000-000000000001";
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: createCommand(otuId),
		});
		await excludeLocalOtuAccession(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "ExcludeAccession",
				schemaVersion: 1,
				otuId,
				expectedVersion: 1,
				payload: { accessionBase: "NC_001367" },
			},
		});

		await deleteReferenceV2(db, reference.id);

		await expect(getReferenceV2(db, reference.id)).rejects.toBeInstanceOf(
			ReferenceV2NotFoundError,
		);
		const [otuCount] = await db
			.select({ value: count() })
			.from(otusV2)
			.where(eq(otusV2.referenceId, reference.id));
		expect(otuCount.value).toBe(0);
	});

	it("rejects deletion of a missing Reference", async () => {
		await expect(
			deleteReferenceV2(db, "70000000-0000-4000-8000-000000000001"),
		).rejects.toBeInstanceOf(ReferenceV2NotFoundError);
	});
});

describe("createLocalOtu", () => {
	it("promotes a GenBank base atomically and blocks its reimport", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: {
				...create,
				payload: {
					...create.payload,
					genbank: {
						sequences: [
							{
								sequenceId: create.payload.isolate.sequences[0].id,
								accession: "NC_001367.1",
							},
						],
					},
				},
			},
		});
		const command = {
			type: "PromoteIsolate" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				proposedTaxonomy: {
					name: "Novel virus",
					lineage: create.payload.taxonomy.lineage,
				},
				sequences: [
					{
						sequenceId: create.payload.isolate.sequences[0].id,
						segmentId: create.payload.plan.segments[0].id,
						previousAccessionVersion: "NC_001367.1",
						accessionVersion: "NC_888888.1",
						definition: "New reference",
						sequence: "ATCGNNRY",
						proposedSegment: null,
						approved: true,
					},
				],
			},
		};
		const promoted = await promoteLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command,
		});
		expect(promoted.promotedAccessionBases).toEqual([
			{ accessionBase: "NC_001367", promotedToBase: "NC_888888" },
		]);
		expect(promoted.changes[0]).toMatchObject({
			command: "PromoteIsolate",
			isolateId: create.payload.isolate.id,
			accessions: [
				{ from: "NC_001367.1", to: "NC_888888.1", kind: "promotion" },
			],
		});
		expect(JSON.stringify(promoted.changes)).not.toContain("ATCGNNRY");
		expect(
			(
				await getLocalOtuSequence(
					db,
					reference.id,
					original.id,
					create.payload.isolate.id,
					create.payload.isolate.sequences[0].id,
				)
			).accessionVersion,
		).toBe("NC_888888.1");
		await expect(
			promoteLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command,
			}),
		).rejects.toBeInstanceOf(OtuV2VersionConflictError);
		const reimportSequenceId = randomUUID();
		await expect(
			createLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: {
					type: "CreateIsolate",
					schemaVersion: 1,
					otuId: original.id,
					expectedVersion: 2,
					payload: {
						isolate: {
							id: randomUUID(),
							name: null,
							sequences: [
								{
									id: reimportSequenceId,
									definition: "Old",
									sequence: "ATCGNNRY",
									segmentId: create.payload.plan.segments[0].id,
								},
							],
						},
						genbank: {
							sequences: [
								{ sequenceId: reimportSequenceId, accession: "NC_001367.2" },
							],
						},
					},
				},
			}),
		).rejects.toBeInstanceOf(OtuV2PromotedAccessionError);
		await expect(
			previewExcludeLocalOtuAccession(db, reference.id, {
				type: "ExcludeAccession",
				schemaVersion: 1,
				otuId: original.id,
				expectedVersion: 2,
				payload: { accessionBase: "NC_001367" },
			}),
		).rejects.toBeInstanceOf(OtuV2PromotedAccessionError);
		await deleteReferenceV2(db, reference.id);
		await expect(
			getLocalOtu(db, reference.id, original.id),
		).rejects.toBeInstanceOf(OtuV2NotFoundError);
	});

	it("rejects partial, duplicate, and excluded multipartite replacement sets", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const secondSegment = {
			id: randomUUID(),
			name: { prefix: "RNA", key: "2" },
			length: 8,
			lengthTolerance: 0,
			rule: "required" as const,
		};
		const secondSequence = {
			id: randomUUID(),
			segmentId: secondSegment.id,
			definition: "Segment 2",
			sequence: "ATCGNNRY",
		};
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: {
				...create,
				payload: {
					...create.payload,
					plan: {
						...create.payload.plan,
						segments: [
							{
								...create.payload.plan.segments[0],
								name: { prefix: "RNA", key: "1" },
							},
							secondSegment,
						],
					},
					isolate: {
						...create.payload.isolate,
						sequences: [...create.payload.isolate.sequences, secondSequence],
					},
					genbank: {
						sequences: [
							{
								sequenceId: create.payload.isolate.sequences[0].id,
								accession: "NC_001367.1",
							},
							{ sequenceId: secondSequence.id, accession: "NC_001368.1" },
						],
					},
				},
			},
		});
		const firstEntry = {
			sequenceId: create.payload.isolate.sequences[0].id,
			segmentId: create.payload.plan.segments[0].id,
			previousAccessionVersion: "NC_001367.1",
			accessionVersion: "NC_999999.1",
			definition: "Replacement 1",
			sequence: "ATCGNNRY",
			proposedSegment: null,
			approved: true,
		};
		const secondEntry = {
			sequenceId: secondSequence.id,
			segmentId: secondSegment.id,
			previousAccessionVersion: "NC_001368.1",
			accessionVersion: "NC_001368.1",
			definition: secondSequence.definition,
			sequence: secondSequence.sequence,
			proposedSegment: null,
			approved: false,
		};
		const base = {
			type: "PromoteIsolate" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				proposedTaxonomy: {
					name: "Novel virus",
					lineage: create.payload.taxonomy.lineage,
				},
				sequences: [firstEntry, secondEntry],
			},
		};
		await expect(
			promoteLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: {
					...base,
					payload: { ...base.payload, sequences: [firstEntry] },
				},
			}),
		).rejects.toBeInstanceOf(OtuV2InvalidProvenanceError);
		await expect(
			promoteLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: {
					...base,
					payload: {
						...base.payload,
						sequences: [
							firstEntry,
							{
								...secondEntry,
								accessionVersion: "NC_999999.1",
								approved: true,
							},
						],
					},
				},
			}),
		).rejects.toBeInstanceOf(OtuV2DuplicateAccessionError);
		await excludeLocalOtuAccession(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "ExcludeAccession",
				schemaVersion: 1,
				otuId: original.id,
				expectedVersion: 1,
				payload: { accessionBase: "NC_999999" },
			},
		});
		await expect(
			promoteLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: { ...base, expectedVersion: 2 },
			}),
		).rejects.toBeInstanceOf(OtuV2ExcludedAccessionError);
		const still = await getLocalOtu(db, reference.id, original.id);
		expect(still.isolates[0]?.sequences).toHaveLength(2);
	});
	it("blocks future imports of excluded bases and allow does not alter existing isolates", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const exclude = {
			type: "ExcludeAccession" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: { accessionBase: "nc_001367" },
		};
		const preview = await previewExcludeLocalOtuAccession(
			db,
			reference.id,
			exclude,
		);
		expect(preview).toMatchObject({
			accessionBase: "NC_001367",
			retiredIsolate: null,
			canExclude: true,
		});
		const excluded = await excludeLocalOtuAccession(db, {
			referenceId: reference.id,
			userId,
			command: exclude,
		});
		expect(excluded.excludedAccessionBases).toEqual(["NC_001367"]);
		expect(excluded.isolates).toHaveLength(1);
		expect(excluded.changes[0]).toMatchObject({
			command: "ExcludeAccession",
			accessionBase: "NC_001367",
			retiredIsolate: null,
		});
		await expect(
			excludeLocalOtuAccession(db, {
				referenceId: reference.id,
				userId,
				command: { ...exclude, expectedVersion: 2 },
			}),
		).rejects.toBeInstanceOf(OtuV2AlreadyExcludedAccessionError);
		const importCommand = {
			type: "CreateIsolate" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 2,
			payload: {
				genbank: {
					sequences: [{ sequenceId: randomUUID(), accession: "NC_001367.7" }],
				},
				isolate: {
					id: randomUUID(),
					name: null,
					sequences: [] as Array<{
						id: string;
						definition: string;
						sequence: string;
						segmentId: string;
					}>,
				},
			},
		};
		const importSequenceId =
			importCommand.payload.genbank.sequences[0].sequenceId;
		importCommand.payload.isolate.sequences.push({
			id: importSequenceId,
			definition: "Imported",
			sequence: "ATCGNNRY",
			segmentId: create.payload.plan.segments[0].id,
		});
		await expect(
			createLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: importCommand,
			}),
		).rejects.toBeInstanceOf(OtuV2ExcludedAccessionError);
		const allowed = await allowLocalOtuAccession(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "AllowAccession",
				schemaVersion: 1,
				otuId: original.id,
				expectedVersion: 2,
				payload: { accessionBase: "NC_001367" },
			},
		});
		expect(allowed.excludedAccessionBases).toEqual([]);
		expect(allowed.isolates).toHaveLength(1);
		await expect(
			allowLocalOtuAccession(db, {
				referenceId: reference.id,
				userId,
				command: {
					type: "AllowAccession",
					schemaVersion: 1,
					otuId: original.id,
					expectedVersion: 3,
					payload: { accessionBase: "NC_001367" },
				},
			}),
		).rejects.toBeInstanceOf(OtuV2AccessionNotExcludedError);
		const imported = await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: { ...importCommand, expectedVersion: 3 },
		});
		expect(imported.isolates).toHaveLength(2);
	});

	it("retires the whole multipartite isolate when an active base is excluded and protects the last isolate", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const secondSegmentId = randomUUID();
		const secondSequenceId = randomUUID();
		const accession = "NC_001367.1";
		const multipartite = {
			...create,
			payload: {
				...create.payload,
				plan: {
					...create.payload.plan,
					segments: [
						{
							...create.payload.plan.segments[0],
							name: { prefix: "RNA", key: "1" },
						},
						{
							id: secondSegmentId,
							name: { prefix: "RNA", key: "2" },
							length: 8,
							lengthTolerance: 0,
							rule: "required" as const,
						},
					],
				},
				isolate: {
					...create.payload.isolate,
					sequences: [
						create.payload.isolate.sequences[0],
						{
							id: secondSequenceId,
							definition: "Segment 2",
							sequence: "ATCGNNRY",
							segmentId: secondSegmentId,
						},
					],
				},
				genbank: {
					sequences: [
						{ sequenceId: create.payload.isolate.sequences[0].id, accession },
						{ sequenceId: secondSequenceId, accession: "NC_001368.1" },
					],
				},
			},
		};
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: multipartite,
		});
		const exclude = {
			type: "ExcludeAccession" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: { accessionBase: "NC_001367" },
		};
		expect(
			await previewExcludeLocalOtuAccession(db, reference.id, exclude),
		).toMatchObject({
			retiredIsolate: { id: create.payload.isolate.id },
			canExclude: false,
		});
		await expect(
			excludeLocalOtuAccession(db, {
				referenceId: reference.id,
				userId,
				command: exclude,
			}),
		).rejects.toBeInstanceOf(OtuV2LastIsolateError);
		expect((await getLocalOtu(db, reference.id, original.id)).version).toBe(1);
		const survivorId = randomUUID();
		await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: original.id,
				expectedVersion: 1,
				payload: {
					isolate: {
						id: survivorId,
						name: null,
						sequences: [
							{
								id: randomUUID(),
								definition: "Manual 1",
								sequence: "ATCGNNRY",
								segmentId: create.payload.plan.segments[0].id,
							},
							{
								id: randomUUID(),
								definition: "Manual 2",
								sequence: "ATCGNNRY",
								segmentId: secondSegmentId,
							},
						],
					},
				},
			},
		});
		const excluded = await excludeLocalOtuAccession(db, {
			referenceId: reference.id,
			userId,
			command: { ...exclude, expectedVersion: 2 },
		});
		expect(excluded.isolates.map((isolate) => isolate.id)).toEqual([
			survivorId,
		]);
		expect(excluded.excludedAccessionBases).toEqual(["NC_001367"]);
		expect(excluded.changes[0]).toMatchObject({
			command: "ExcludeAccession",
			accessionBase: "NC_001367",
			retiredIsolate: {
				id: create.payload.isolate.id,
				name: create.payload.isolate.name,
			},
		});
		const retiredRows = await db
			.select({
				id: otuSequences.id,
				retiredVersion: otuSequences.retiredVersion,
			})
			.from(otuSequences)
			.where(eq(otuSequences.otuId, original.id));
		expect(
			retiredRows
				.filter((row) => row.retiredVersion === 3)
				.map((row) => row.id)
				.toSorted(),
		).toEqual(
			[create.payload.isolate.sequences[0].id, secondSequenceId].toSorted(),
		);
		const allowed = await allowLocalOtuAccession(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "AllowAccession",
				schemaVersion: 1,
				otuId: original.id,
				expectedVersion: 3,
				payload: { accessionBase: "NC_001367" },
			},
		});
		expect(allowed.isolates.map((isolate) => isolate.id)).toEqual([survivorId]);
		expect(allowed.changes[0]).toMatchObject({
			command: "AllowAccession",
			accessionBase: "NC_001367",
		});
	});
	it("previews and versions a valid manual sequence edit without body in overview history", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const command = {
			type: "UpdateSequence" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				sequenceId: create.payload.isolate.sequences[0].id,
				segmentId: create.payload.plan.segments[0].id,
				definition: "Revised genome",
				sequence: " A T C G N N R Y ",
				source: "manual" as const,
				accessionVersion: null,
			},
		};
		const preview = await previewLocalOtuSequence(db, reference.id, command);
		expect(preview.isolates).toMatchObject([
			{ isolateId: command.payload.isolateId, issues: [] },
		]);
		expect(JSON.stringify(preview)).not.toContain("ATCGNNRY");
		const updated = await updateLocalOtuSequence(db, {
			referenceId: reference.id,
			userId,
			command,
		});
		expect(updated.version).toBe(2);
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				original.id,
				command.payload.isolateId,
				command.payload.sequenceId,
			),
		).toMatchObject({
			definition: "Revised genome",
			sequence: "ATCGNNRY",
			source: "manual",
			accessionVersion: null,
		});
		expect(updated.changes[0]).toMatchObject({
			command: "UpdateSequence",
			sequenceSource: "manual",
			previousSource: "manual",
		});
		expect(
			JSON.stringify(
				(await getLocalOtuOverview(db, reference.id, original.id)).changes,
			),
		).not.toContain("ATCGNNRY");
		await expect(
			updateLocalOtuSequence(db, {
				referenceId: reference.id,
				userId,
				command,
			}),
		).rejects.toBeInstanceOf(OtuV2VersionConflictError);
	});

	it("rejects a sequence edit that invalidates the isolate plan", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const command = {
			type: "UpdateSequence" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				sequenceId: create.payload.isolate.sequences[0].id,
				segmentId: create.payload.plan.segments[0].id,
				definition: "Too short",
				sequence: "ATCG",
				source: "manual" as const,
				accessionVersion: null,
			},
		};
		expect(
			(await previewLocalOtuSequence(db, reference.id, command)).isolates[0]
				?.issues.length,
		).toBeGreaterThan(0);
		await expect(
			updateLocalOtuSequence(db, {
				referenceId: reference.id,
				userId,
				command,
			}),
		).rejects.toBeInstanceOf(OtuV2InvalidIsolateError);
		expect((await getLocalOtu(db, reference.id, original.id)).version).toBe(1);
	});

	it("retains exact GenBank accession only with unchanged bases, then records conversion to manual", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const accessionVersion = "NC_001367.1";
		const imported = {
			...create,
			payload: {
				...create.payload,
				genbank: {
					sequences: [
						{
							sequenceId: create.payload.isolate.sequences[0].id,
							accession: accessionVersion,
						},
					],
				},
			},
		};
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: imported,
		});
		const base = {
			type: "UpdateSequence" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				sequenceId: create.payload.isolate.sequences[0].id,
				segmentId: create.payload.plan.segments[0].id,
				definition: "Revised GenBank description",
				sequence: "ATCGNNRY",
				source: "genbank" as const,
				accessionVersion,
			},
		};
		const preserved = await updateLocalOtuSequence(db, {
			referenceId: reference.id,
			userId,
			command: base,
		});
		expect(preserved.changes[0]).toMatchObject({
			command: "UpdateSequence",
			sequenceSource: "genbank",
			accessionVersion,
		});
		const changed = {
			...base,
			expectedVersion: 2,
			payload: { ...base.payload, sequence: "ATCGNNRA" },
		};
		expect(
			(await previewLocalOtuSequence(db, reference.id, changed))
				.provenanceIssues.length,
		).toBeGreaterThan(0);
		await expect(
			updateLocalOtuSequence(db, {
				referenceId: reference.id,
				userId,
				command: changed,
			}),
		).rejects.toBeInstanceOf(OtuV2InvalidProvenanceError);
		const converted = await updateLocalOtuSequence(db, {
			referenceId: reference.id,
			userId,
			command: {
				...changed,
				payload: {
					...changed.payload,
					source: "manual" as const,
					accessionVersion: null,
				},
			},
		});
		expect(converted.changes[0]).toMatchObject({
			command: "UpdateSequence",
			previousSource: "genbank",
			previousAccessionVersion: accessionVersion,
			sequenceSource: "manual",
			accessionVersion: null,
		});
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				original.id,
				base.payload.isolateId,
				base.payload.sequenceId,
			),
		).toMatchObject({
			source: "manual",
			accessionVersion: null,
			sequence: "ATCGNNRA",
		});
		const [row] = await db
			.select({ accessionBase: otuSequences.accessionBase })
			.from(otuSequences)
			.where(eq(otuSequences.id, base.payload.sequenceId));
		expect(row?.accessionBase).toBeNull();
		const reimportIsolateId = randomUUID();
		const reimportSequenceId = randomUUID();
		const reimported = await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: original.id,
				expectedVersion: 3,
				payload: {
					genbank: {
						sequences: [
							{ sequenceId: reimportSequenceId, accession: accessionVersion },
						],
					},
					isolate: {
						id: reimportIsolateId,
						name: null,
						sequences: [
							{
								id: reimportSequenceId,
								definition: "Reimported genome",
								sequence: "ATCGNNRY",
								segmentId: base.payload.segmentId,
							},
						],
					},
				},
			},
		});
		expect(reimported.version).toBe(4);
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				original.id,
				reimportIsolateId,
				reimportSequenceId,
			),
		).toMatchObject({
			source: "genbank",
			accessionVersion,
		});
	});
	it("versions isolate name metadata without changing sequences or provenance", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const sequence = original.isolates[0]?.sequences[0];
		const sequenceBefore = await getLocalOtuSequence(
			db,
			reference.id,
			original.id,
			create.payload.isolate.id,
			create.payload.isolate.sequences[0].id,
		);
		const command = {
			type: "UpdateIsolate" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				name: { type: "strain" as const, value: "  A1  " },
			},
		};
		const updated = await updateLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command,
		});
		expect(updated.version).toBe(2);
		expect(updated.isolates[0]?.name).toEqual({ type: "strain", value: "A1" });
		expect(updated.isolates[0]?.sequences).toEqual(
			original.isolates[0]?.sequences,
		);
		expect(updated.isolates[0]?.sequences[0]).toEqual(sequence);
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				original.id,
				create.payload.isolate.id,
				create.payload.isolate.sequences[0].id,
			),
		).toEqual(sequenceBefore);
		expect(updated.changes[0]).toMatchObject({
			command: "UpdateIsolate",
			name: { type: "strain", value: "A1" },
			version: 2,
		});
		expect(JSON.stringify(updated.changes)).not.toContain("ATCGNNRY");
		await expect(
			updateLocalOtuIsolate(db, { referenceId: reference.id, userId, command }),
		).rejects.toBeInstanceOf(OtuV2VersionConflictError);
		const cleared = await updateLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				...command,
				expectedVersion: 2,
				payload: { ...command.payload, name: null },
			},
		});
		expect(cleared.isolates[0]?.name).toBeNull();
		expect(cleared.changes[0]).toMatchObject({
			command: "UpdateIsolate",
			name: null,
			version: 3,
		});
		expect(cleared.isolates[0]?.sequences).toEqual(
			original.isolates[0]?.sequences,
		);
	});

	it("rejects isolate metadata edits for missing isolates and archived references", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const command = {
			type: "UpdateIsolate" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				isolateId: randomUUID(),
				name: { type: "strain" as const, value: "A1" },
			},
		};
		await expect(
			updateLocalOtuIsolate(db, { referenceId: reference.id, userId, command }),
		).rejects.toBeInstanceOf(OtuV2NotFoundError);
		await db
			.update(referenceRoots)
			.set({ archived: true })
			.where(eq(referenceRoots.id, reference.id));
		await expect(
			updateLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: {
					...command,
					payload: { ...command.payload, isolateId: create.payload.isolate.id },
				},
			}),
		).rejects.toBeInstanceOf(OtuV2ReferenceNotWritableError);
	});
	it("previews and versions a plan edit while preserving isolate provenance", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const command = {
			type: "UpdatePlan" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				molecule: {
					type: "DNA" as const,
					strandedness: "double" as const,
					topology: "circular" as const,
				},
				plan: {
					id: original.plan.id,
					segments: [
						{
							...original.plan.segments[0],
							length: 8,
							lengthTolerance: 0.1,
							rule: "required" as const,
						},
					],
				},
			},
		};
		const preview = await previewLocalOtuPlan(db, reference.id, command);
		expect(preview.isolates).toEqual([
			{
				isolateId: create.payload.isolate.id,
				name: create.payload.isolate.name,
				issues: [],
			},
		]);
		expect(JSON.stringify(preview)).not.toContain("ATCGNNRY");
		const updated = await updateLocalOtuPlan(db, {
			referenceId: reference.id,
			userId,
			command,
		});
		expect(updated.version).toBe(2);
		expect(updated.molecule).toEqual(command.payload.molecule);
		expect(updated.plan.segments[0]).toMatchObject({
			id: create.payload.plan.segments[0].id,
			lengthTolerance: 0.1,
		});
		expect(updated.isolates).toEqual(original.isolates);
		expect(updated.changes[0]).toMatchObject({
			command: "UpdatePlan",
			segmentCount: 1,
			version: 2,
		});
		expect(JSON.stringify(updated.changes)).not.toContain("ATCGNNRY");
		await expect(
			updateLocalOtuPlan(db, { referenceId: reference.id, userId, command }),
		).rejects.toBeInstanceOf(OtuV2VersionConflictError);
	});

	it("rejects plans that invalidate surviving isolates without advancing the OTU", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		create.payload.plan.segments[0].lengthTolerance = 0.25;
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const secondIsolateId = randomUUID();
		await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: original.id,
				expectedVersion: 1,
				payload: {
					isolate: {
						id: secondIsolateId,
						name: null,
						sequences: [
							{
								id: randomUUID(),
								definition: "Longer genome",
								sequence: "ATCGNNRYAA",
								segmentId: create.payload.plan.segments[0].id,
							},
						],
					},
				},
			},
		});
		const command = {
			type: "UpdatePlan" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 2,
			payload: {
				molecule: original.molecule,
				plan: {
					id: original.plan.id,
					segments: [{ ...original.plan.segments[0], lengthTolerance: 0 }],
				},
			},
		};
		const preview = await previewLocalOtuPlan(db, reference.id, command);
		expect(preview.isolates).toHaveLength(2);
		expect(
			preview.isolates.find(
				(isolate) => isolate.isolateId === create.payload.isolate.id,
			)?.issues,
		).toEqual([]);
		expect(
			preview.isolates.find((isolate) => isolate.isolateId === secondIsolateId)
				?.issues.length,
		).toBeGreaterThan(0);
		await expect(
			updateLocalOtuPlan(db, { referenceId: reference.id, userId, command }),
		).rejects.toBeInstanceOf(OtuV2InvalidIsolateError);
		expect((await getLocalOtu(db, reference.id, original.id)).version).toBe(2);
	});

	it("adds an optional named segment while retaining the occupied segment ID", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		const command = {
			type: "UpdatePlan" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: {
				molecule: original.molecule,
				plan: {
					id: original.plan.id,
					segments: [
						{ ...original.plan.segments[0], name: { prefix: "RNA", key: "1" } },
						{
							id: randomUUID(),
							name: { prefix: "RNA", key: "2" },
							length: 8,
							lengthTolerance: 0,
							rule: "optional" as const,
						},
					],
				},
			},
		};
		expect(
			(await previewLocalOtuPlan(db, reference.id, command)).isolates[0]
				?.issues,
		).toEqual([]);
		const updated = await updateLocalOtuPlan(db, {
			referenceId: reference.id,
			userId,
			command,
		});
		expect(updated.plan.segments).toHaveLength(2);
		expect(updated.isolates[0]?.sequences[0]?.segmentId).toBe(
			create.payload.plan.segments[0].id,
		);
	});

	it("rejects plan preview and save for archived references", async () => {
		const reference = await createReference();
		const create = createCommand(randomUUID());
		const original = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: create,
		});
		await db
			.update(referenceRoots)
			.set({ archived: true })
			.where(eq(referenceRoots.id, reference.id));
		const command = {
			type: "UpdatePlan" as const,
			schemaVersion: 1 as const,
			otuId: original.id,
			expectedVersion: 1,
			payload: { molecule: original.molecule, plan: original.plan },
		};
		await expect(
			previewLocalOtuPlan(db, reference.id, command),
		).rejects.toBeInstanceOf(OtuV2ReferenceNotWritableError);
		await expect(
			updateLocalOtuPlan(db, { referenceId: reference.id, userId, command }),
		).rejects.toBeInstanceOf(OtuV2ReferenceNotWritableError);
	});

	it("edits taxonomy without changing ownership or mixed sequence provenance", async () => {
		const reference = await createReference();
		const command = createCommand(randomUUID());
		const manual = {
			...command,
			payload: {
				...command.payload,
				taxonomy: { ...command.payload.taxonomy, lineage: [] },
			},
		};
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: manual,
		});
		const edit = {
			type: "UpdateTaxonomy" as const,
			schemaVersion: 1 as const,
			otuId: command.otuId,
			expectedVersion: 1,
			payload: {
				name: "Updated virus",
				acronym: "UV",
				lineage: [{ id: 3044, name: "Updated virus", rank: "species" }],
			},
		};
		const updated = await updateLocalOtuTaxonomy(db, {
			referenceId: reference.id,
			userId,
			command: edit,
		});
		expect(updated.taxonomy).toMatchObject({
			kind: "local",
			identityId: command.payload.taxonomy.identityId,
			name: "Updated virus",
			lineage: edit.payload.lineage,
		});
		expect(updated.changes[0]).toMatchObject({
			command: "UpdateTaxonomy",
			name: "Updated virus",
			version: 2,
		});
		expect(JSON.stringify(updated.changes)).not.toContain("ATCGNNRY");
		await expect(
			updateLocalOtuTaxonomy(db, {
				referenceId: reference.id,
				userId,
				command: edit,
			}),
		).rejects.toBeInstanceOf(OtuV2VersionConflictError);
		const segmentId = command.payload.plan.segments[0].id;
		const sequenceId = randomUUID();
		const isolateId = randomUUID();
		await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: command.otuId,
				expectedVersion: 2,
				payload: {
					genbank: { sequences: [{ sequenceId, accession: "NC_001367.1" }] },
					isolate: {
						id: isolateId,
						name: null,
						sequences: [
							{
								id: sequenceId,
								definition: "Imported",
								sequence: "ATCGNNRY",
								segmentId,
							},
						],
					},
				},
			},
		});
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				command.otuId,
				command.payload.isolate.id,
				command.payload.isolate.sequences[0].id,
			),
		).toMatchObject({ source: "manual", accessionVersion: null });
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				command.otuId,
				isolateId,
				sequenceId,
			),
		).toMatchObject({ source: "genbank", accessionVersion: "NC_001367.1" });
	});

	it("persists a manual multipartite plan and its first isolate together", async () => {
		const reference = await createReference();
		const command = createCommand(randomUUID());
		const first = command.payload.plan.segments[0];
		const firstSequence = command.payload.isolate.sequences[0];
		const secondId = randomUUID();
		const secondSequenceId = randomUUID();
		const multipartite = {
			...command,
			payload: {
				...command.payload,
				plan: {
					...command.payload.plan,
					segments: [
						{ ...first, name: { prefix: "RNA", key: "1" } },
						{
							id: secondId,
							name: { prefix: "RNA", key: "2" },
							length: 6,
							lengthTolerance: 0.1,
							rule: "recommended" as const,
						},
					],
				},
				isolate: {
					...command.payload.isolate,
					sequences: [
						firstSequence,
						{
							id: secondSequenceId,
							definition: "RNA 2",
							sequence: "AACCGG",
							segmentId: secondId,
						},
					],
				},
			},
		};
		const otu = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: multipartite,
		});
		expect(otu.plan.segments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: { prefix: "RNA", key: "1" },
					length: 8,
					rule: "required",
				}),
				expect.objectContaining({
					name: { prefix: "RNA", key: "2" },
					length: 6,
					lengthTolerance: 0.1,
					rule: "recommended",
				}),
			]),
		);
		expect(
			otu.isolates[0]?.sequences.map((sequence) => sequence.segmentId).sort(),
		).toEqual([first.id, secondId].sort());
		const storedSequences = await Promise.all([
			getLocalOtuSequence(
				db,
				reference.id,
				command.otuId,
				command.payload.isolate.id,
				firstSequence.id,
			),
			getLocalOtuSequence(
				db,
				reference.id,
				command.otuId,
				command.payload.isolate.id,
				secondSequenceId,
			),
		]);
		expect(storedSequences.map((sequence) => sequence.source)).toEqual([
			"manual",
			"manual",
		]);
	});

	it("deduplicates active GenBank accessions and permits re-import after deletion", async () => {
		const reference = await createReference();
		const command = createCommand(randomUUID());
		const firstSequence = command.payload.isolate.sequences[0];
		const segment = command.payload.plan.segments[0];
		const accession = "NC_001367.1";
		const imported = {
			...command,
			payload: {
				...command.payload,
				genbank: {
					sequences: [{ sequenceId: firstSequence.id, accession }],
				},
			},
		};
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: imported,
		});
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				command.otuId,
				command.payload.isolate.id,
				firstSequence.id,
			),
		).toMatchObject({ source: "genbank", accessionVersion: accession });
		await expect(
			db.insert(otuSequences).values({
				id: randomUUID(),
				otuId: command.otuId,
				accessionBase: "NC_001367",
			}),
		).rejects.toThrow();

		const manualIsolateId = randomUUID();
		const manualSequenceId = randomUUID();
		await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: command.otuId,
				expectedVersion: 1,
				payload: {
					isolate: {
						id: manualIsolateId,
						name: null,
						sequences: [
							{
								id: manualSequenceId,
								definition: "Manual sequence",
								sequence: "ATCGNNRY",
								segmentId: segment.id,
							},
						],
					},
				},
			},
		});
		expect(
			await getLocalOtuSequence(
				db,
				reference.id,
				command.otuId,
				manualIsolateId,
				manualSequenceId,
			),
		).toMatchObject({ source: "manual", accessionVersion: null });

		function makeImport(expectedVersion: number) {
			const sequenceId = randomUUID();
			return {
				type: "CreateIsolate" as const,
				schemaVersion: 1 as const,
				otuId: command.otuId,
				expectedVersion,
				payload: {
					genbank: {
						sequences: [{ sequenceId, accession: "nc_001367.2" }],
					},
					isolate: {
						id: randomUUID(),
						name: null,
						sequences: [
							{
								id: sequenceId,
								definition: "Complete genome",
								sequence: "ATCGNNRY",
								segmentId: segment.id,
							},
						],
					},
				},
			};
		}
		await expect(
			createLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: makeImport(2),
			}),
		).rejects.toBeInstanceOf(OtuV2DuplicateAccessionError);
		expect((await getLocalOtu(db, reference.id, command.otuId)).version).toBe(
			2,
		);

		await deleteLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "DeleteIsolate",
				schemaVersion: 1,
				otuId: command.otuId,
				expectedVersion: 2,
				payload: { isolateId: command.payload.isolate.id },
			},
		});
		const reimported = makeImport(3);
		await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: reimported,
		});
		expect((await getLocalOtu(db, reference.id, command.otuId)).version).toBe(
			4,
		);
	});

	it("rejects invalid direct isolate writes without advancing the version", async () => {
		const reference = await createReference();
		const command = createCommand("11000000-0000-4000-8000-000000000001");
		command.payload.plan.segments.push({
			id: "11000000-0000-4000-8000-000000000009",
			name: null,
			length: 8,
			lengthTolerance: 0,
			rule: "required",
		});
		command.payload.isolate.sequences.push({
			id: "11000000-0000-4000-8000-00000000000a",
			definition: "Segment B",
			sequence: "ATCGATCG",
			segmentId: command.payload.plan.segments[1].id,
		});
		const multipartiteCommand = {
			...command,
			payload: {
				...command.payload,
				plan: {
					...command.payload.plan,
					segments: command.payload.plan.segments.map((segment, index) => ({
						...segment,
						name: { prefix: "RNA", key: String(index + 1) },
					})),
				},
			},
		};
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: multipartiteCommand,
		});

		const base = {
			type: "CreateIsolate" as const,
			schemaVersion: 1 as const,
			otuId: command.otuId,
			expectedVersion: 1,
			payload: {
				isolate: {
					id: "11000000-0000-4000-8000-00000000000b",
					name: null,
					sequences: [
						{
							id: "11000000-0000-4000-8000-00000000000c",
							definition: "A",
							sequence: "ATCGATCG",
							segmentId: command.payload.plan.segments[0].id,
						},
						{
							id: "11000000-0000-4000-8000-00000000000d",
							definition: "B",
							sequence: "ATCGATCG",
							segmentId: command.payload.plan.segments[1].id,
						},
					],
				},
			},
		};
		const invalid = [
			{
				...base,
				payload: {
					isolate: {
						...base.payload.isolate,
						sequences: base.payload.isolate.sequences.slice(0, 1),
					},
				},
			},
			{
				...base,
				payload: {
					isolate: {
						...base.payload.isolate,
						sequences: [
							{ ...base.payload.isolate.sequences[0], sequence: "ATCG" },
							base.payload.isolate.sequences[1],
						],
					},
				},
			},
			{
				...base,
				payload: {
					isolate: {
						...base.payload.isolate,
						sequences: [
							base.payload.isolate.sequences[0],
							{
								...base.payload.isolate.sequences[1],
								segmentId: base.payload.isolate.sequences[0].segmentId,
							},
						],
					},
				},
			},
			{
				...base,
				payload: {
					isolate: {
						...base.payload.isolate,
						sequences: [
							base.payload.isolate.sequences[0],
							{
								...base.payload.isolate.sequences[1],
								id: base.payload.isolate.sequences[0].id,
							},
						],
					},
				},
			},
			{
				...base,
				payload: {
					isolate: {
						...base.payload.isolate,
						sequences: [
							base.payload.isolate.sequences[0],
							{
								...base.payload.isolate.sequences[1],
								segmentId: command.payload.plan.id,
							},
						],
					},
				},
			},
		];
		for (const attempted of invalid) {
			await expect(
				createLocalOtuIsolate(db, {
					referenceId: reference.id,
					userId,
					command: attempted,
				}),
			).rejects.toBeInstanceOf(OtuV2InvalidIsolateError);
		}
		const otu = await getLocalOtu(db, reference.id, command.otuId);
		expect(otu.version).toBe(1);
		expect(otu.isolates).toHaveLength(1);
	});
	it("soft-deletes an isolate and its sequences in a new version", async () => {
		const reference = await createReference();
		const command = createCommand("60000000-0000-4000-8000-000000000001");
		await createLocalOtu(db, { referenceId: reference.id, userId, command });
		const isolateId = "60000000-0000-4000-8000-000000000007";
		await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: command.otuId,
				expectedVersion: 1,
				payload: {
					isolate: {
						id: isolateId,
						name: { type: "isolate", value: "Lab 2" },
						sequences: [
							{
								id: "60000000-0000-4000-8000-000000000008",
								definition: "Complete genome",
								sequence: "ATCGNNRY",
								segmentId: command.payload.plan.segments[0].id,
							},
						],
					},
				},
			},
		});

		const otu = await deleteLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "DeleteIsolate",
				schemaVersion: 1,
				otuId: command.otuId,
				expectedVersion: 2,
				payload: { isolateId },
			},
		});

		expect(otu.version).toBe(3);
		expect(otu.isolates).toHaveLength(1);
		expect(otu.mostRecentChange).toMatchObject({
			version: 3,
			command: "DeleteIsolate",
		});
		await expect(
			getLocalOtuIsolate(db, reference.id, command.otuId, isolateId),
		).rejects.toBeInstanceOf(OtuV2NotFoundError);
	});

	it("does not delete an OTU's last isolate", async () => {
		const reference = await createReference();
		const command = createCommand("61000000-0000-4000-8000-000000000001");
		await createLocalOtu(db, { referenceId: reference.id, userId, command });

		await expect(
			deleteLocalOtuIsolate(db, {
				referenceId: reference.id,
				userId,
				command: {
					type: "DeleteIsolate",
					schemaVersion: 1,
					otuId: command.otuId,
					expectedVersion: 1,
					payload: { isolateId: command.payload.isolate.id },
				},
			}),
		).rejects.toBeInstanceOf(OtuV2LastIsolateError);
		expect((await getLocalOtu(db, reference.id, command.otuId)).version).toBe(
			1,
		);
	});

	it("returns the complete change history newest first", async () => {
		const reference = await createReference();
		const otuId = "90000000-0000-4000-8000-000000000001";
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: createCommand(otuId),
		});

		const otu = await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId,
				expectedVersion: 1,
				payload: {
					isolate: {
						id: "90000000-0000-4000-8000-000000000007",
						name: { type: "isolate", value: "Lab 2" },
						sequences: [
							{
								id: "90000000-0000-4000-8000-000000000008",
								definition: "Complete genome",
								sequence: "ATCGNNRY",
								segmentId: "90000000-0000-4000-8000-000000000004",
							},
						],
					},
				},
			},
		});

		expect(otu.changes).toMatchObject([
			{
				version: 2,
				command: "CreateIsolate",
				name: { type: "isolate", value: "Lab 2" },
			},
			{ version: 1, command: "CreateOTU", name: "Novel virus" },
		]);
		expect(otu.changes[0]).not.toHaveProperty("payload");
		expect(otu.changes[1]).not.toHaveProperty("payload");

		const overview = await getLocalOtuOverview(db, reference.id, otuId);
		expect(overview.changes).toEqual(otu.changes);
		expect(JSON.stringify(overview)).not.toContain("ATCGNNRY");
	});

	it("commits and assembles one complete version with semantic history", async () => {
		const reference = await createReference();
		const otu = await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: createCommand(),
		});

		expect(otu).toMatchObject({
			id: IDS.otu,
			referenceId: reference.id,
			version: 1,
			taxonomy: {
				kind: "local",
				identityId: IDS.identity,
				name: "Novel virus",
				acronym: "NV",
				lineage: [
					{ id: 10239, name: "Viruses", rank: "superkingdom" },
					{ id: 3044, name: "Novel virus", rank: "species" },
				],
			},
			plan: { id: IDS.plan },
			isolates: [
				{
					id: IDS.isolate,
					sequences: [
						{
							id: IDS.sequence,
							sequence: "ATCGNNRY",
							segmentId: IDS.segment,
						},
					],
				},
			],
			mostRecentChange: {
				version: 1,
				command: "CreateOTU",
				commandSchemaVersion: 1,
				source: "user",
				user: { id: userId, handle: "alice" },
			},
		});

		const [change] = await db
			.select()
			.from(otuChanges)
			.where(eq(otuChanges.otuId, IDS.otu));
		expect(change.payload).toEqual({
			...createCommand().payload,
			isolate: {
				...createCommand().payload.isolate,
				sequences: [
					{
						...createCommand().payload.isolate.sequences[0],
						sequence: "ATCGNNRY",
					},
				],
			},
		});

		await db
			.update(otuChanges)
			.set({ payload: { corrupted: true } as never })
			.where(eq(otuChanges.otuId, IDS.otu));
		const assembledWithoutReplay = await getLocalOtu(db, reference.id, IDS.otu);
		expect(assembledWithoutReplay.taxonomy.name).toBe("Novel virus");
		expect(assembledWithoutReplay.taxonomy.lineage).toEqual([
			{ id: 10239, name: "Viruses", rank: "superkingdom" },
			{ id: 3044, name: "Novel virus", rank: "species" },
		]);
		expect(assembledWithoutReplay.isolates[0].sequences[0].sequence).toBe(
			"ATCGNNRY",
		);
	});

	it("scopes reads to the parent Reference", async () => {
		const reference = await createReference();
		const otherReference = await createReference();
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: createCommand("20000000-0000-4000-8000-000000000001"),
		});

		await expect(
			getLocalOtu(
				db,
				otherReference.id,
				"20000000-0000-4000-8000-000000000001",
			),
		).rejects.toBeInstanceOf(OtuV2NotFoundError);
	});

	it("rejects conflicting aggregate identities", async () => {
		const reference = await createReference();
		const command = createCommand("30000000-0000-4000-8000-000000000001");
		await createLocalOtu(db, { referenceId: reference.id, userId, command });
		const conflicting = createCommand("31000000-0000-4000-8000-000000000001");
		conflicting.payload.taxonomy.identityId =
			command.payload.taxonomy.identityId;

		await expect(
			createLocalOtu(db, {
				referenceId: reference.id,
				userId,
				command: conflicting,
			}),
		).rejects.toBeInstanceOf(OtuV2ConflictError);

		const [otuCount] = await db
			.select({ value: count() })
			.from(otusV2)
			.where(eq(otusV2.id, conflicting.otuId));
		expect(otuCount.value).toBe(0);
	});

	it("allows only one concurrent creation of the same aggregate", async () => {
		const reference = await createReference();
		const connection = database.connect();
		const command = createCommand("32000000-0000-4000-8000-000000000001");

		try {
			const outcomes = await Promise.allSettled([
				createLocalOtu(db, { referenceId: reference.id, userId, command }),
				createLocalOtu(connection.db, {
					referenceId: reference.id,
					userId,
					command,
				}),
			]);

			expect(
				outcomes.filter(({ status }) => status === "fulfilled"),
			).toHaveLength(1);
			expect(
				outcomes.filter(({ status }) => status === "rejected"),
			).toHaveLength(1);
			const [changeCount] = await db
				.select({ value: count() })
				.from(otuChanges)
				.where(eq(otuChanges.otuId, command.otuId));
			expect(changeCount.value).toBe(1);
		} finally {
			await connection.close();
		}
	});

	it("persists nothing when validation fails", async () => {
		const reference = await createReference();
		const command = createCommand("40000000-0000-4000-8000-000000000001");
		command.payload.isolate.sequences[0].sequence = "invalid";

		await expect(
			createLocalOtu(db, { referenceId: reference.id, userId, command }),
		).rejects.toThrow();

		const [otuCount] = await db
			.select({ value: count() })
			.from(otusV2)
			.where(eq(otusV2.id, command.otuId));
		const [changeCount] = await db
			.select({ value: count() })
			.from(otuChanges)
			.where(eq(otuChanges.otuId, command.otuId));
		expect(otuCount.value).toBe(0);
		expect(changeCount.value).toBe(0);
	});
});

describe("getLocalOtus", () => {
	it("summarizes the Reference's OTUs ordered by name", async () => {
		const reference = await createReference();

		const zebra = createCommand("50000000-0000-4000-8000-000000000001");
		zebra.payload.taxonomy.name = "Zebra virus";
		zebra.payload.taxonomy.acronym = "ZV";
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: zebra,
		});

		const alpha = createCommand("51000000-0000-4000-8000-000000000001");
		alpha.payload.taxonomy.name = "Alpha virus";
		(alpha.payload.taxonomy as { acronym: string | null }).acronym = null;
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: alpha,
		});

		const summaries = await getLocalOtus(db, reference.id);

		expect(summaries).toEqual([
			{
				id: alpha.otuId,
				name: "Alpha virus",
				acronym: null,
				version: 1,
				isolateCount: 1,
			},
			{
				id: zebra.otuId,
				name: "Zebra virus",
				acronym: "ZV",
				version: 1,
				isolateCount: 1,
			},
		]);
	});

	it("scopes the summary to the parent Reference", async () => {
		const reference = await createReference();
		const otherReference = await createReference();
		await createLocalOtu(db, {
			referenceId: otherReference.id,
			userId,
			command: createCommand("52000000-0000-4000-8000-000000000001"),
		});

		expect(await getLocalOtus(db, reference.id)).toEqual([]);
	});
});
