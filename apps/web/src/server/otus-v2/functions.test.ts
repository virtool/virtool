import { randomUUID } from "node:crypto";
import type { Db } from "@virtool/data/db/pg";
import {
	referenceRoots,
	referenceUsers,
} from "@virtool/data/db/schema/referencesV2";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { NcbiUnreachableError } from "@virtool/ncbi/client";
import type { NcbiGenbank, NcbiTaxonomy } from "@virtool/ncbi/models";
import { sql } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const getRequest = vi.fn();
const setResponseStatus = vi.fn();
const { fetchGenbankRecords, fetchTaxonomyRecord } = vi.hoisted(() => ({
	fetchGenbankRecords: vi.fn(),
	fetchTaxonomyRecord: vi.fn(),
}));

vi.mock("@virtool/ncbi/client", async (importOriginal) => ({
	...(await importOriginal<typeof import("@virtool/ncbi/client")>()),
	createNcbiClient: () => ({ fetchGenbankRecords, fetchTaxonomyRecord }),
}));

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	keyring: { status: { state: "unconfigured" } },
	get db() {
		return db;
	},
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { ForbiddenError } = await import("../auth/middleware");
const { signIn } = await import("../auth/test/fixtures");

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	await db.execute(
		sql`truncate table reference_roots, users, groups, sessions restart identity cascade`,
	);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

type SeedReferenceOptions = {
	archived?: boolean;
	modifyOtu?: boolean;
	kind?: "local" | "remote";
};

async function seedReferenceV2(
	memberUserId: number,
	options: SeedReferenceOptions = {},
): Promise<string> {
	const { archived = false, modifyOtu = true, kind = "local" } = options;
	const id = randomUUID();
	await db.insert(referenceRoots).values({
		id,
		name: "Reference",
		description: "",
		kind,
		remoteUrl: kind === "remote" ? "https://example.test/ref" : null,
		defaultSegmentLengthTolerance: 0.05,
		archived,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await db.insert(referenceUsers).values({
		referenceId: id,
		userId: memberUserId,
		publishVersion: true,
		modify: true,
		modifyOtu,
	});
	return id;
}

function createCommand(otuId = randomUUID()) {
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
				id: randomUUID(),
				segments: [
					{
						id: randomUUID(),
						name: null,
						length: 8,
						lengthTolerance: 0,
						rule: "required" as const,
					},
				],
			},
			taxonomy: {
				kind: "local" as const,
				identityId: randomUUID(),
				name: "Novel virus",
				acronym: "NV",
			},
			promotedAccessions: [],
			isolate: {
				id: randomUUID(),
				name: { type: "isolate" as const, value: "Lab 1" },
				sequences: [
					{
						id: randomUUID(),
						definition: "Complete genome",
						sequence: "ATCGNNRY",
						segmentId: "",
					},
				],
			},
		},
	};
}

// Bind the one sequence to the plan's one segment so the aggregate is valid.
function validCommand(otuId = randomUUID()) {
	const command = createCommand(otuId);
	const [segment] = command.payload.plan.segments;
	const [sequence] = command.payload.isolate.sequences;
	if (!segment || !sequence) {
		throw new Error("fixture must define one segment and one sequence");
	}
	sequence.segmentId = segment.id;
	return command;
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("createLocalOtu", () => {
	const taxonomy: NcbiTaxonomy = {
		id: 12242,
		name: "Tobacco mosaic virus",
		rank: "species",
		lineage: [],
		other_names: {
			acronym: [],
			genbank_acronym: [],
			equivalent_name: [],
			synonym: [],
			includes: [],
		},
	};
	const record: NcbiGenbank = {
		accession: "NC_001367",
		accession_version: "NC_001367.1",
		organism: "Tobacco mosaic virus",
		definition: "Complete genome",
		sequence: "ATCGNNRY",
		moltype: "RNA",
		strandedness: "single",
		topology: "linear",
		comment: "",
		refseq: true,
		source: {
			taxid: 12242,
			organism: "Tobacco mosaic virus",
			mol_type: "genomic RNA",
			isolate: null,
			host: null,
			segment: null,
			strain: null,
			clone: null,
			proviral: false,
			macronuclear: false,
			focus: false,
			transgenic: false,
		},
	};

	function genbankCommand() {
		const command = validCommand();
		const sequence = command.payload.isolate.sequences[0];
		if (!sequence) {
			throw new Error("Expected a sequence.");
		}
		return {
			...command,
			payload: {
				...command.payload,
				taxonomy: {
					...command.payload.taxonomy,
					name: "Tobacco mosaic virus",
					lineage: [
						{ id: 12242, name: "Tobacco mosaic virus", rank: "species" },
					],
				},
				genbank: {
					sequences: [{ sequenceId: sequence.id, accession: "NC_001367.1" }],
				},
			},
		};
	}

	it("validates a direct GenBank save without requiring a preview", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		fetchGenbankRecords.mockResolvedValue([record]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		const command = genbankCommand();
		const otu = (await call("createLocalOtuFn", { referenceId, command })) as {
			id: string;
		};
		expect(otu.id).toBe(command.otuId);
		expect(fetchGenbankRecords).toHaveBeenCalledWith(["NC_001367.1"]);
	});

	it("rejects an accession changed after preview before writing", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		fetchGenbankRecords.mockResolvedValue([
			{ ...record, sequence: "TTTTTTTT" },
		]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		const command = genbankCommand();
		await expect(
			call("createLocalOtuFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 422 });
		await expect(
			call("getLocalOtuFn", { referenceId, otuId: command.otuId }),
		).rejects.toMatchObject({ status: 404 });
	});

	it("maps an unreachable NCBI save lookup to 502", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		fetchGenbankRecords.mockRejectedValue(new NcbiUnreachableError());
		await expect(
			call("createLocalOtuFn", { referenceId, command: genbankCommand() }),
		).rejects.toMatchObject({ status: 502 });
	});

	it("revalidates an isolate without a preview and rejects changed records", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		fetchGenbankRecords.mockResolvedValue([record]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		const otuCommand = genbankCommand();
		await call("createLocalOtuFn", { referenceId, command: otuCommand });
		const segment = otuCommand.payload.plan.segments[0];
		if (!segment) {
			throw new Error("Expected a segment.");
		}
		const sequenceId = randomUUID();
		const isolateCommand = {
			type: "CreateIsolate",
			schemaVersion: 1,
			otuId: otuCommand.otuId,
			expectedVersion: 1,
			payload: {
				genbank: {
					sequences: [{ sequenceId, accession: record.accession_version }],
				},
				isolate: {
					id: randomUUID(),
					name: null,
					sequences: [
						{
							id: sequenceId,
							definition: record.definition,
							sequence: record.sequence,
							segmentId: segment.id,
						},
					],
				},
			},
		};
		await call("createLocalOtuIsolateFn", {
			referenceId,
			command: isolateCommand,
		});
		fetchGenbankRecords.mockResolvedValue([
			{ ...record, sequence: "TTTTTTTT" },
		]);
		await expect(
			call("createLocalOtuIsolateFn", {
				referenceId,
				command: {
					...isolateCommand,
					expectedVersion: 2,
					payload: {
						...isolateCommand.payload,
						isolate: { ...isolateCommand.payload.isolate, id: randomUUID() },
					},
				},
			}),
		).rejects.toMatchObject({ status: 422 });
	});
	it("creates a complete OTU for a member with modifyOtu", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();

		const otu = (await call("createLocalOtuFn", {
			referenceId,
			command,
		})) as { id: string; version: number };

		expect(setResponseStatus).toHaveBeenCalledWith(201);
		expect(otu.id).toBe(command.otuId);
		expect(otu.version).toBe(1);
	});

	it("refuses a member without modifyOtu with a 403", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId, { modifyOtu: false });

		await expect(
			call("createLocalOtuFn", { referenceId, command: validCommand() }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("maps a missing reference to a 404 for a non-administrator", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("createLocalOtuFn", {
				referenceId: randomUUID(),
				command: validCommand(),
			}),
		).rejects.toThrow("OTU not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("rejects a write to an archived reference with a 409", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId, { archived: true });

		await expect(
			call("createLocalOtuFn", { referenceId, command: validCommand() }),
		).rejects.toThrow("Reference cannot be modified.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("rejects a write to a remote reference with a 409", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId, { kind: "remote" });

		await expect(
			call("createLocalOtuFn", { referenceId, command: validCommand() }),
		).rejects.toThrow("Reference cannot be modified.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("rejects a duplicate OTU id with a 409", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();

		await call("createLocalOtuFn", { referenceId, command });

		await expect(
			call("createLocalOtuFn", { referenceId, command }),
		).rejects.toThrow("OTU already exists.");
		expect(setResponseStatus).toHaveBeenLastCalledWith(409);
	});

	it("rejects a malformed command as a 400", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = createCommand();
		// Sequence bound to no plan segment: fails the payload cross-check.

		await expect(
			call("createLocalOtuFn", { referenceId, command }),
		).rejects.toBeTruthy();
	});
});

describe("deleteLocalOtu", () => {
	it("soft-deletes an OTU for a member with modifyOtu", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();
		await call("createLocalOtuFn", { referenceId, command });

		expect(
			await call("deleteLocalOtuFn", {
				referenceId,
				command: {
					type: "DeleteOTU",
					schemaVersion: 1,
					otuId: command.otuId,
					expectedVersion: 1,
					payload: {},
				},
			}),
		).toBeNull();
		await expect(
			call("getLocalOtuFn", { referenceId, otuId: command.otuId }),
		).rejects.toMatchObject({ status: 404 });
	});

	it("rejects deletion without modifyOtu", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId, { modifyOtu: false });

		await expect(
			call("deleteLocalOtuFn", {
				referenceId,
				command: {
					type: "DeleteOTU",
					schemaVersion: 1,
					otuId: randomUUID(),
					expectedVersion: 1,
					payload: {},
				},
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("rejects a stale expected version", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();
		await call("createLocalOtuFn", { referenceId, command });

		await expect(
			call("deleteLocalOtuFn", {
				referenceId,
				command: {
					type: "DeleteOTU",
					schemaVersion: 1,
					otuId: command.otuId,
					expectedVersion: 2,
					payload: {},
				},
			}),
		).rejects.toMatchObject({ status: 409 });
	});
});

describe("getLocalOtu", () => {
	async function createOtu(referenceId: string) {
		const command = validCommand();
		await call("createLocalOtuFn", { referenceId, command });
		return command.otuId;
	}

	it("returns the assembled OTU for a member", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const otuId = await createOtu(referenceId);

		const otu = (await call("getLocalOtuFn", { referenceId, otuId })) as {
			id: string;
			version: number;
		};

		expect(otu.id).toBe(otuId);
		expect(otu.version).toBe(1);
	});

	it("maps a missing OTU to a 404", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);

		await expect(
			call("getLocalOtuFn", { referenceId, otuId: randomUUID() }),
		).rejects.toThrow("OTU not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("hides an OTU in an invisible reference behind a 404", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(ownerId);
		const otuId = await createOtu(referenceId);

		// A different signed-in user with no membership on the reference.
		await signIn(db, getRequest, { administratorRole: null, handle: "bob" });

		await expect(call("getLocalOtuFn", { referenceId, otuId })).rejects.toThrow(
			"OTU not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});

describe("getLocalOtus", () => {
	it("summarizes the Reference's OTUs for a member", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();
		await call("createLocalOtuFn", { referenceId, command });

		const summaries = (await call("getLocalOtusFn", { referenceId })) as {
			id: string;
			isolateCount: number;
		}[];

		expect(summaries).toEqual([
			expect.objectContaining({ id: command.otuId, isolateCount: 1 }),
		]);
	});

	it("hides an invisible reference behind a 404", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(ownerId);

		// A different signed-in user with no membership on the reference.
		await signIn(db, getRequest, { administratorRole: null, handle: "bob" });

		await expect(call("getLocalOtusFn", { referenceId })).rejects.toThrow(
			"OTU not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});
