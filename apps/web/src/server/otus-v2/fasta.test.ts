import { randomUUID } from "node:crypto";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { referenceUsers } from "@virtool/data/db/schema/referencesV2";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	createLocalOtu,
	createLocalOtuIsolate,
	deleteLocalOtuIsolate,
	updateLocalOtuSequence,
} from "@virtool/data/otus-v2/data";
import { getV2FastaPage } from "@virtool/data/otus-v2/fasta";
import {
	createReferenceV2,
	setReferenceV2Archived,
} from "@virtool/data/references-v2/data";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const requireAuthenticatedRequest = vi.fn();
let referenceV2Beta = true;
vi.mock("../auth/middleware", () => ({ requireAuthenticatedRequest }));
vi.mock("../composition", () => ({
	get referenceV2Beta() {
		return referenceV2Beta;
	},
	get db() {
		return db;
	},
}));

const { handleV2Fasta } = await import("./fasta");
let database: TestDatabase;
let db: Db;
let ownerId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	ownerId = await seedUser(db);
}, 60_000);

afterAll(async () => {
	await database.drop();
});

function request(): Request {
	return new Request("https://virtool.test/refs/alpha/export/fasta");
}

async function createReference() {
	return createReferenceV2(db, {
		name: "Export",
		description: "",
		defaultSegmentLengthTolerance: 0,
		userId: ownerId,
	});
}

async function createOtu(referenceId: string) {
	const otuId = randomUUID();
	const isolateId = randomUUID();
	const sequenceId = randomUUID();
	const segmentId = randomUUID();
	await createLocalOtu(db, {
		referenceId,
		userId: ownerId,
		command: {
			type: "CreateOTU",
			schemaVersion: 1,
			otuId,
			expectedVersion: 0,
			payload: {
				molecule: { type: "RNA", strandedness: "single", topology: "linear" },
				plan: {
					id: randomUUID(),
					segments: [
						{
							id: segmentId,
							name: null,
							length: 4,
							lengthTolerance: 0,
							rule: "required",
						},
					],
				},
				taxonomy: {
					kind: "local",
					identityId: randomUUID(),
					name: "Test virus",
					acronym: null,
					lineage: [],
				},
				promotedAccessions: [],
				isolate: {
					id: isolateId,
					name: { type: "isolate", value: "First" },
					sequences: [
						{
							id: sequenceId,
							segmentId,
							definition: "GenBank",
							sequence: "ATCG",
						},
					],
				},
				genbank: { sequences: [{ sequenceId, accession: "NC_123456.2" }] },
			},
		},
	});
	return { otuId, isolateId, sequenceId, segmentId };
}

describe("v2 FASTA download", () => {
	it("is unavailable when the Reference beta is disabled", async () => {
		referenceV2Beta = false;
		try {
			expect(
				(await handleV2Fasta(request(), { referenceId: randomUUID() })).status,
			).toBe(404);
			expect(requireAuthenticatedRequest).not.toHaveBeenCalled();
		} finally {
			referenceV2Beta = true;
		}
	});
	it("requires authentication and Reference membership, without modify or a published version", async () => {
		const reference = await createReference();
		const otherUserId = await seedUser(db, { handle: "bob" });
		requireAuthenticatedRequest.mockResolvedValueOnce(
			new Response("Unauthorized", { status: 401 }),
		);
		expect(
			(await handleV2Fasta(request(), { referenceId: reference.id })).status,
		).toBe(401);
		requireAuthenticatedRequest.mockResolvedValueOnce({ userId: otherUserId });
		expect(
			(await handleV2Fasta(request(), { referenceId: reference.id })).status,
		).toBe(404);
		await db.insert(referenceUsers).values({
			referenceId: reference.id,
			userId: otherUserId,
			modify: false,
			modifyOtu: false,
			publishVersion: false,
		});
		requireAuthenticatedRequest.mockResolvedValueOnce({ userId: otherUserId });
		const response = await handleV2Fasta(request(), {
			referenceId: reference.id,
		});
		expect(response.status).toBe(200);
		expect(response.body).toBeInstanceOf(ReadableStream);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("content-disposition")).toContain(
			`reference-${reference.id}.fa`,
		);
		expect(await response.text()).toBe("");
		await setReferenceV2Archived(db, reference.id, true);
		requireAuthenticatedRequest.mockResolvedValueOnce({ userId: otherUserId });
		expect(
			(await handleV2Fasta(request(), { referenceId: reference.id })).status,
		).toBe(200);
	});

	it("exports only current sequences at Reference, OTU, and isolate scopes", async () => {
		const reference = await createReference();
		const first = await createOtu(reference.id);
		const secondIsolateId = randomUUID();
		const secondSequenceId = randomUUID();
		await createLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId: ownerId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: first.otuId,
				expectedVersion: 1,
				payload: {
					isolate: {
						id: secondIsolateId,
						name: null,
						sequences: [
							{
								id: secondSequenceId,
								segmentId: first.segmentId,
								definition: "Manual",
								sequence: "GGGG",
							},
						],
					},
				},
			},
		});
		await updateLocalOtuSequence(db, {
			referenceId: reference.id,
			userId: ownerId,
			command: {
				type: "UpdateSequence",
				schemaVersion: 1,
				otuId: first.otuId,
				expectedVersion: 2,
				payload: {
					isolateId: secondIsolateId,
					sequenceId: secondSequenceId,
					segmentId: first.segmentId,
					definition: "Revised",
					sequence: "CCCC",
					source: "manual",
					accessionVersion: null,
				},
			},
		});
		requireAuthenticatedRequest.mockResolvedValue({ userId: ownerId });
		const referenceResponse = await handleV2Fasta(request(), {
			referenceId: reference.id,
		});
		const text = await referenceResponse.text();
		const firstPage = await getV2FastaPage(
			db,
			{ referenceId: reference.id },
			null,
			1,
		);
		const secondPage = await getV2FastaPage(
			db,
			{ referenceId: reference.id },
			firstPage[0]?.sequenceId ?? null,
			1,
		);
		expect(firstPage).toHaveLength(1);
		expect(secondPage).toHaveLength(1);
		expect(secondPage[0]?.sequenceId).not.toBe(firstPage[0]?.sequenceId);
		expect(text).toContain(
			`sequence=${first.sequenceId}|segment=${first.segmentId}|source=genbank|accession=NC_123456.2\nATCG\n`,
		);
		expect(text).toContain(
			`sequence=${secondSequenceId}|segment=${first.segmentId}|source=manual\nCCCC\n`,
		);
		expect(text).not.toContain("GGGG");
		const isolate = await handleV2Fasta(request(), {
			referenceId: reference.id,
			otuId: first.otuId,
			isolateId: first.isolateId,
		});
		expect(await isolate.text()).toContain("NC_123456.2");
		const otherIsolate = await handleV2Fasta(request(), {
			referenceId: reference.id,
			otuId: first.otuId,
			isolateId: secondIsolateId,
		});
		expect(await otherIsolate.text()).not.toContain("NC_123456.2");
		const otu = await handleV2Fasta(request(), {
			referenceId: reference.id,
			otuId: first.otuId,
		});
		expect(await otu.text()).toBe(text);
		const otherReference = await createReference();
		expect(
			(
				await handleV2Fasta(request(), {
					referenceId: otherReference.id,
					otuId: first.otuId,
				})
			).status,
		).toBe(404);
		expect(
			(
				await handleV2Fasta(request(), {
					referenceId: reference.id,
					otuId: first.otuId,
					isolateId: randomUUID(),
				})
			).status,
		).toBe(404);
		await deleteLocalOtuIsolate(db, {
			referenceId: reference.id,
			userId: ownerId,
			command: {
				type: "DeleteIsolate",
				schemaVersion: 1,
				otuId: first.otuId,
				expectedVersion: 3,
				payload: { isolateId: secondIsolateId },
			},
		});
		const afterDelete = await handleV2Fasta(request(), {
			referenceId: reference.id,
		});
		expect(await afterDelete.text()).not.toContain(secondSequenceId);
		expect(
			(
				await handleV2Fasta(request(), {
					referenceId: reference.id,
					otuId: first.otuId,
					isolateId: secondIsolateId,
				})
			).status,
		).toBe(404);
	});
});
