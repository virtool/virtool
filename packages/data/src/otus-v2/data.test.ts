import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { otuChanges, otusV2 } from "../db/schema/otusV2";
import { referenceUsers } from "../db/schema/referencesV2";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { createReferenceV2 } from "../references-v2/data";
import {
	createLocalOtu,
	getLocalOtu,
	OtuV2ConflictError,
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
			build: true,
			modify: true,
			modifyOtu: true,
		});
	});
});

describe("createLocalOtu", () => {
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
				userId,
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
