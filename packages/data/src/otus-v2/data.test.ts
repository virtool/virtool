import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { otuChanges, otuSequences, otusV2 } from "../db/schema/otusV2";
import { referenceUsers } from "../db/schema/referencesV2";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createReferenceV2,
	deleteReferenceV2,
	getReferenceV2,
	ReferenceV2NotFoundError,
} from "../references-v2/data";
import {
	createLocalOtu,
	createLocalOtuIsolate,
	deleteLocalOtuIsolate,
	getLocalOtu,
	getLocalOtuIsolate,
	getLocalOtuSequence,
	getLocalOtus,
	OtuV2ConflictError,
	OtuV2DuplicateAccessionError,
	OtuV2InvalidIsolateError,
	OtuV2LastIsolateError,
	OtuV2NotFoundError,
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
		await createLocalOtu(db, {
			referenceId: reference.id,
			userId,
			command: createCommand("80000000-0000-4000-8000-000000000001"),
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
			payload: { isolateId },
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
			{ version: 2, command: "CreateIsolate" },
			{ version: 1, command: "CreateOTU" },
		]);
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
