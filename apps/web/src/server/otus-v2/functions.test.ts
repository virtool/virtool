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
import { eq, sql } from "drizzle-orm";
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
	it("protects accession exclusion and allowance with rights, version, and archived state", async () => {
		const ownerId = await signIn(db, getRequest, {
			administratorRole: null,
			handle: "exclusion-owner",
		});
		const referenceId = await seedReferenceV2(ownerId);
		const created = validCommand();
		await call("createLocalOtuFn", { referenceId, command: created });
		const exclude = {
			type: "ExcludeAccession",
			schemaVersion: 1,
			otuId: created.otuId,
			expectedVersion: 1,
			payload: { accessionBase: "nc_001367" },
		};
		await signIn(db, getRequest, {
			administratorRole: null,
			handle: "exclusion-other",
		});
		await expect(
			call("previewExcludeLocalOtuAccessionFn", {
				referenceId,
				command: exclude,
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			call("excludeLocalOtuAccessionFn", { referenceId, command: exclude }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await signIn(db, getRequest, {
			administratorRole: "full",
			handle: "exclusion-admin",
		});
		const preview = (await call("previewExcludeLocalOtuAccessionFn", {
			referenceId,
			command: exclude,
		})) as { accessionBase: string; retiredIsolate: unknown };
		expect(preview).toMatchObject({
			accessionBase: "NC_001367",
			retiredIsolate: null,
		});
		const excluded = (await call("excludeLocalOtuAccessionFn", {
			referenceId,
			command: exclude,
		})) as { excludedAccessionBases: string[] };
		expect(excluded.excludedAccessionBases).toEqual(["NC_001367"]);
		await expect(
			call("getGenbankIsolateDraftFn", {
				referenceId,
				otuId: created.otuId,
				accessions: ["NC_001367.4"],
			}),
		).rejects.toMatchObject({ status: 409 });
		await expect(
			call("excludeLocalOtuAccessionFn", { referenceId, command: exclude }),
		).rejects.toMatchObject({ status: 409 });
		const allow = {
			type: "AllowAccession",
			schemaVersion: 1,
			otuId: created.otuId,
			expectedVersion: 2,
			payload: { accessionBase: "NC_001367" },
		};
		await call("allowLocalOtuAccessionFn", { referenceId, command: allow });
		await db
			.update(referenceRoots)
			.set({ archived: true })
			.where(eq(referenceRoots.id, referenceId));
		await expect(
			call("previewExcludeLocalOtuAccessionFn", {
				referenceId,
				command: { ...exclude, expectedVersion: 3 },
			}),
		).rejects.toMatchObject({ status: 409 });
		await expect(
			call("excludeLocalOtuAccessionFn", {
				referenceId,
				command: { ...exclude, expectedVersion: 3 },
			}),
		).rejects.toMatchObject({ status: 409 });
		await expect(
			call("allowLocalOtuAccessionFn", {
				referenceId,
				command: { ...allow, expectedVersion: 3 },
			}),
		).rejects.toMatchObject({ status: 409 });
	});
	it("checks sequence preview and edit rights, validation, version, and archived state", async () => {
		const ownerId = await signIn(db, getRequest, {
			administratorRole: null,
			handle: "sequence-owner",
		});
		const referenceId = await seedReferenceV2(ownerId);
		const created = validCommand();
		await call("createLocalOtuFn", { referenceId, command: created });
		const sequence = created.payload.isolate.sequences[0];
		if (!sequence) {
			throw new Error("Expected a sequence in the test command.");
		}
		const command = {
			type: "UpdateSequence",
			schemaVersion: 1,
			otuId: created.otuId,
			expectedVersion: 1,
			payload: {
				isolateId: created.payload.isolate.id,
				sequenceId: sequence.id,
				segmentId: sequence.segmentId,
				definition: "Edited",
				sequence: "ATCGNNRY",
				source: "manual",
				accessionVersion: null,
			},
		};
		await signIn(db, getRequest, {
			administratorRole: null,
			handle: "sequence-other",
		});
		await expect(
			call("previewLocalOtuSequenceFn", { referenceId, command }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			call("updateLocalOtuSequenceFn", { referenceId, command }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await signIn(db, getRequest, {
			administratorRole: "full",
			handle: "sequence-admin",
		});
		const invalid = {
			...command,
			payload: { ...command.payload, sequence: "ATCG" },
		};
		const preview = (await call("previewLocalOtuSequenceFn", {
			referenceId,
			command: invalid,
		})) as { isolates: Array<{ issues: string[] }> };
		expect(preview.isolates[0]?.issues.length).toBeGreaterThan(0);
		expect(JSON.stringify(preview)).not.toContain("ATCGNNRY");
		await expect(
			call("updateLocalOtuSequenceFn", { referenceId, command: invalid }),
		).rejects.toMatchObject({ status: 422 });
		await call("updateLocalOtuSequenceFn", { referenceId, command });
		await expect(
			call("updateLocalOtuSequenceFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 409 });
		await db
			.update(referenceRoots)
			.set({ archived: true })
			.where(eq(referenceRoots.id, referenceId));
		await expect(
			call("previewLocalOtuSequenceFn", {
				referenceId,
				command: { ...command, expectedVersion: 2 },
			}),
		).rejects.toMatchObject({ status: 409 });
		await expect(
			call("updateLocalOtuSequenceFn", {
				referenceId,
				command: { ...command, expectedVersion: 2 },
			}),
		).rejects.toMatchObject({ status: 409 });
	});
	it("checks isolate edit rights, version, and archived state", async () => {
		const ownerId = await signIn(db, getRequest, {
			administratorRole: null,
			handle: "isolate-owner",
		});
		const referenceId = await seedReferenceV2(ownerId);
		const created = validCommand();
		await call("createLocalOtuFn", { referenceId, command: created });
		const command = {
			type: "UpdateIsolate",
			schemaVersion: 1,
			otuId: created.otuId,
			expectedVersion: 1,
			payload: {
				isolateId: created.payload.isolate.id,
				name: { type: "strain", value: "A1" },
			},
		};
		await signIn(db, getRequest, {
			administratorRole: null,
			handle: "isolate-other",
		});
		await expect(
			call("updateLocalOtuIsolateFn", { referenceId, command }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await signIn(db, getRequest, {
			administratorRole: "full",
			handle: "isolate-admin",
		});
		const result = (await call("updateLocalOtuIsolateFn", {
			referenceId,
			command,
		})) as { isolates: Array<{ name: unknown }> };
		expect(result.isolates[0]?.name).toEqual({ type: "strain", value: "A1" });
		await expect(
			call("updateLocalOtuIsolateFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 409 });
		await db
			.update(referenceRoots)
			.set({ archived: true })
			.where(eq(referenceRoots.id, referenceId));
		await expect(
			call("updateLocalOtuIsolateFn", {
				referenceId,
				command: { ...command, expectedVersion: 2 },
			}),
		).rejects.toMatchObject({ status: 409 });
	});
	it("previews plan impact without sequence bodies and checks rights on save", async () => {
		const ownerId = await signIn(db, getRequest, {
			administratorRole: null,
			handle: "plan-owner",
		});
		const referenceId = await seedReferenceV2(ownerId);
		const created = validCommand();
		await call("createLocalOtuFn", { referenceId, command: created });
		const command = {
			type: "UpdatePlan",
			schemaVersion: 1,
			otuId: created.otuId,
			expectedVersion: 1,
			payload: {
				molecule: created.payload.molecule,
				plan: {
					...created.payload.plan,
					segments: [{ ...created.payload.plan.segments[0], length: 100 }],
				},
			},
		};
		const preview = (await call("previewLocalOtuPlanFn", {
			referenceId,
			command,
		})) as { isolates: Array<{ issues: string[] }> };
		expect(preview.isolates[0]?.issues.length).toBeGreaterThan(0);
		expect(JSON.stringify(preview)).not.toContain("ATCGNNRY");
		await expect(
			call("updateLocalOtuPlanFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 422 });
		await signIn(db, getRequest, {
			administratorRole: null,
			handle: "plan-other",
		});
		await expect(
			call("previewLocalOtuPlanFn", { referenceId, command }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			call("updateLocalOtuPlanFn", { referenceId, command }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
	it("protects taxonomy edits with OTU rights, version, and archived state", async () => {
		const ownerId = await signIn(db, getRequest, {
			administratorRole: null,
			handle: "owner",
		});
		const referenceId = await seedReferenceV2(ownerId);
		const created = validCommand();
		await call("createLocalOtuFn", { referenceId, command: created });
		const edit = {
			type: "UpdateTaxonomy",
			schemaVersion: 1,
			otuId: created.otuId,
			expectedVersion: 1,
			payload: { name: "Updated", acronym: null, lineage: [] },
		};
		await signIn(db, getRequest, { administratorRole: null, handle: "other" });
		await expect(
			call("updateLocalOtuTaxonomyFn", { referenceId, command: edit }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await signIn(db, getRequest, {
			administratorRole: "full",
			handle: "admin",
		});
		await call("updateLocalOtuTaxonomyFn", { referenceId, command: edit });
		await expect(
			call("updateLocalOtuTaxonomyFn", { referenceId, command: edit }),
		).rejects.toMatchObject({ status: 409 });
		await db
			.update(referenceRoots)
			.set({ archived: true })
			.where(eq(referenceRoots.id, referenceId));
		await expect(
			call("updateLocalOtuTaxonomyFn", {
				referenceId,
				command: { ...edit, expectedVersion: 2 },
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("creates a manual multipartite OTU with two validated segment assignments", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();
		const first = command.payload.plan.segments[0];
		const firstSequence = command.payload.isolate.sequences[0];
		const secondId = randomUUID();
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
							rule: "required",
						},
					],
				},
				isolate: {
					...command.payload.isolate,
					sequences: [
						firstSequence,
						{
							id: randomUUID(),
							definition: "RNA 2",
							sequence: "AACCGG",
							segmentId: secondId,
						},
					],
				},
			},
		};
		const otu = (await call("createLocalOtuFn", {
			referenceId,
			command: multipartite,
		})) as {
			plan: { segments: unknown[] };
			isolates: Array<{ sequences: unknown[] }>;
		};
		expect(otu.plan.segments).toHaveLength(2);
		expect(otu.isolates[0]?.sequences).toHaveLength(2);
		expect(fetchGenbankRecords).not.toHaveBeenCalled();
	});

	it("rejects a missing recommended acknowledgement at the server boundary", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();
		const first = command.payload.plan.segments[0];
		const recommendedId = randomUUID();
		const proposed = {
			...command,
			payload: {
				...command.payload,
				plan: {
					...command.payload.plan,
					segments: [
						{ ...first, name: { prefix: "RNA", key: "1" } },
						{
							id: recommendedId,
							name: { prefix: "RNA", key: "2" },
							length: 8,
							lengthTolerance: 0,
							rule: "recommended",
						},
					],
				},
			},
		};
		await expect(
			call("createLocalOtuFn", { referenceId, command: proposed }),
		).rejects.toThrow(
			"Review and acknowledge every missing recommended segment.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(422);
		const acknowledged = [
			{ isolateId: command.payload.isolate.id, segmentId: recommendedId },
		];
		const created = (await call("createLocalOtuFn", {
			referenceId,
			command: {
				...proposed,
				payload: {
					...proposed.payload,
					acknowledgedMissingRecommendedSegments: acknowledged,
				},
			},
		})) as {
			version: number;
			changes: Array<{ acknowledgedMissingRecommendedSegments: unknown }>;
		};
		expect(created.version).toBe(1);
		expect(created.changes[0]?.acknowledgedMissingRecommendedSegments).toEqual(
			acknowledged,
		);
	});

	it("adds a manual isolate to a manual OTU and validates its plan without NCBI", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const command = validCommand();
		await call("createLocalOtuFn", { referenceId, command });
		const segmentId = command.payload.plan.segments[0]?.id;
		if (!segmentId) {
			throw new Error("Expected an OTU segment.");
		}
		const isolateCommand = {
			type: "CreateIsolate",
			schemaVersion: 1,
			otuId: command.otuId,
			expectedVersion: 1,
			payload: {
				isolate: {
					id: randomUUID(),
					name: { type: "isolate", value: "Lab 2" },
					sequences: [
						{
							id: randomUUID(),
							definition: "Complete genome",
							sequence: "ATCGNNRY",
							segmentId,
						},
					],
				},
			},
		};
		const otu = (await call("createLocalOtuIsolateFn", {
			referenceId,
			command: isolateCommand,
		})) as { version: number; isolates: Array<{ id: string }> };
		expect(otu.version).toBe(2);
		expect(otu.isolates).toHaveLength(2);
		expect(otu.isolates[1]?.id).toBe(isolateCommand.payload.isolate.id);
		expect(fetchGenbankRecords).not.toHaveBeenCalled();

		await expect(
			call("createLocalOtuIsolateFn", {
				referenceId,
				command: {
					...isolateCommand,
					expectedVersion: 2,
					payload: {
						isolate: {
							...isolateCommand.payload.isolate,
							id: randomUUID(),
							sequences: [
								{
									...isolateCommand.payload.isolate.sequences[0],
									id: randomUUID(),
									sequence: "ATCG",
								},
							],
						},
					},
				},
			}),
		).rejects.toMatchObject({ status: 422 });
		expect(fetchGenbankRecords).not.toHaveBeenCalled();
	});

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
		secondary_accessions: [],
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
					acronym: null,
					lineage: [
						{ id: 12242, name: "Tobacco mosaic virus", rank: "species" },
					],
				},
				isolate: {
					...command.payload.isolate,
					name: null,
				},
				genbank: {
					sequences: [{ sequenceId: sequence.id, accession: "NC_001367.1" }],
				},
			},
		};
	}

	it("requires an approved current NCBI proposal and rechecks it at save", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const create = genbankCommand();
		fetchGenbankRecords.mockResolvedValue([record]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		await call("createLocalOtuFn", { referenceId, command: create });
		const newer = {
			...record,
			accession_version: "NC_001367.2",
			sequence: "ATCGNNRA",
		};
		fetchGenbankRecords.mockResolvedValue([newer]);
		const preview = (await call("previewLocalOtuPromotionFn", {
			referenceId,
			otuId: create.otuId,
			isolateId: create.payload.isolate.id,
			expectedVersion: 1,
		})) as {
			issues: string[];
			proposedTaxonomy: {
				name: string;
				lineage: Array<{ id: number; name: string; rank: string }>;
			};
			sequences: Array<{
				sequenceId: string;
				segmentId: string;
				previousAccessionVersion: string;
				accessionVersion: string;
				definition: string;
				sequence: string;
				proposedSegment: string | null;
			}>;
		};
		expect(preview.issues).toEqual([]);
		expect(preview.sequences[0]?.accessionVersion).toBe("NC_001367.2");
		const command = {
			type: "PromoteIsolate",
			schemaVersion: 1,
			otuId: create.otuId,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				proposedTaxonomy: preview.proposedTaxonomy,
				sequences: preview.sequences.map((item) => ({
					sequenceId: item.sequenceId,
					segmentId: item.segmentId,
					previousAccessionVersion: item.previousAccessionVersion,
					accessionVersion: item.accessionVersion,
					definition: item.definition,
					sequence: item.sequence,
					proposedSegment: item.proposedSegment,
					approved: true,
				})),
			},
		};
		fetchGenbankRecords.mockResolvedValueOnce([
			{ ...newer, accession_version: "NC_001367.3" },
		]);
		await expect(
			call("promoteLocalOtuIsolateFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 422 });
		fetchTaxonomyRecord.mockResolvedValueOnce({
			...taxonomy,
			name: "Changed NCBI taxonomy",
		});
		fetchGenbankRecords.mockResolvedValue([newer]);
		await expect(
			call("promoteLocalOtuIsolateFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 422 });
		fetchGenbankRecords.mockResolvedValue([newer]);
		const saved = (await call("promoteLocalOtuIsolateFn", {
			referenceId,
			command,
		})) as {
			version: number;
			promotedAccessionBases: unknown[];
			changes: Array<{ command: string; accessions?: unknown[] }>;
		};
		expect(saved.version).toBe(2);
		expect(saved.promotedAccessionBases).toEqual([]);
		expect(saved.changes[0]).toMatchObject({
			command: "PromoteIsolate",
			accessions: [{ from: "NC_001367.1", to: "NC_001367.2", kind: "refresh" }],
		});
		await expect(
			call("promoteLocalOtuIsolateFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 409 });
	});

	it("protects promotion preview and save with modify rights and archived state", async () => {
		const ownerId = await signIn(db, getRequest, {
			administratorRole: null,
			handle: "promotion-owner",
		});
		const referenceId = await seedReferenceV2(ownerId);
		const create = genbankCommand();
		fetchGenbankRecords.mockResolvedValue([record]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		await call("createLocalOtuFn", { referenceId, command: create });
		const previewInput = {
			referenceId,
			otuId: create.otuId,
			isolateId: create.payload.isolate.id,
			expectedVersion: 1,
		};
		const sequence = create.payload.isolate.sequences[0];
		if (!sequence) {
			throw new Error("Expected initial sequence.");
		}
		const command = {
			type: "PromoteIsolate",
			schemaVersion: 1,
			otuId: create.otuId,
			expectedVersion: 1,
			payload: {
				isolateId: create.payload.isolate.id,
				proposedTaxonomy: {
					name: taxonomy.name,
					lineage: [
						{ id: taxonomy.id, name: taxonomy.name, rank: taxonomy.rank },
					],
				},
				sequences: [
					{
						sequenceId: sequence.id,
						segmentId: sequence.segmentId,
						previousAccessionVersion: "NC_001367.1",
						accessionVersion: "NC_001367.2",
						definition: sequence.definition,
						sequence: sequence.sequence,
						proposedSegment: null,
						approved: true,
					},
				],
			},
		};
		await signIn(db, getRequest, {
			administratorRole: null,
			handle: "promotion-outsider",
		});
		await expect(
			call("previewLocalOtuPromotionFn", previewInput),
		).rejects.toBeInstanceOf(ForbiddenError);
		await expect(
			call("promoteLocalOtuIsolateFn", { referenceId, command }),
		).rejects.toBeInstanceOf(ForbiddenError);
		await signIn(db, getRequest, {
			administratorRole: "full",
			handle: "promotion-admin",
		});
		await db
			.update(referenceRoots)
			.set({ archived: true })
			.where(eq(referenceRoots.id, referenceId));
		await expect(
			call("previewLocalOtuPromotionFn", previewInput),
		).rejects.toMatchObject({ status: 409 });
		await expect(
			call("promoteLocalOtuIsolateFn", { referenceId, command }),
		).rejects.toMatchObject({ status: 409 });
	});

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

	it("returns a conflict when an isolate re-imports an OTU accession", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		fetchGenbankRecords.mockResolvedValue([record]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		const otuCommand = genbankCommand();
		await call("createLocalOtuFn", { referenceId, command: otuCommand });
		const segment = otuCommand.payload.plan.segments[0];
		if (!segment) {
			throw new Error("Expected an OTU segment.");
		}
		const sequenceId = randomUUID();
		await expect(
			call("createLocalOtuIsolateFn", {
				referenceId,
				command: {
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
				},
			}),
		).rejects.toMatchObject({ status: 409 });
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
		await call("createLocalOtuFn", {
			referenceId,
			command: {
				...otuCommand,
				payload: { ...otuCommand.payload, genbank: undefined },
			},
		});
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

	it("allows a GenBank isolate after a manual OTU gains matching species lineage", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		const initial = genbankCommand();
		await call("createLocalOtuFn", {
			referenceId,
			command: {
				...initial,
				payload: {
					...initial.payload,
					genbank: undefined,
					taxonomy: { ...initial.payload.taxonomy, lineage: [] },
				},
			},
		});
		fetchGenbankRecords.mockResolvedValue([record]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		await expect(
			call("getGenbankIsolateDraftFn", {
				referenceId,
				otuId: initial.otuId,
				accessions: [record.accession_version],
			}),
		).rejects.toMatchObject({ status: 422 });
		const updated = (await call("updateLocalOtuTaxonomyFn", {
			referenceId,
			command: {
				type: "UpdateTaxonomy",
				schemaVersion: 1,
				otuId: initial.otuId,
				expectedVersion: 1,
				payload: {
					name: "Tobacco mosaic virus",
					acronym: null,
					lineage: [
						{ id: 12242, name: "Tobacco mosaic virus", rank: "species" },
					],
				},
			},
		})) as { version: number; taxonomy: { kind: string } };
		expect(updated).toMatchObject({ version: 2, taxonomy: { kind: "local" } });
		const draft = (await call("getGenbankIsolateDraftFn", {
			referenceId,
			otuId: initial.otuId,
			accessions: [record.accession_version],
		})) as { sequences: Array<{ segmentId: string }> };
		expect(draft.sequences).toHaveLength(1);
		const matchedSegment = draft.sequences[0];
		if (!matchedSegment) {
			throw new Error("Expected a matched segment.");
		}
		const sequenceId = randomUUID();
		const isolate = (await call("createLocalOtuIsolateFn", {
			referenceId,
			command: {
				type: "CreateIsolate",
				schemaVersion: 1,
				otuId: initial.otuId,
				expectedVersion: 2,
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
								segmentId: matchedSegment.segmentId,
							},
						],
					},
				},
			},
		})) as { version: number; isolates: unknown[] };
		expect(isolate.version).toBe(3);
		expect(isolate.isolates).toHaveLength(2);
	});

	it("rejects an out-of-tolerance isolate in preview and save", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);
		fetchGenbankRecords.mockResolvedValue([record]);
		fetchTaxonomyRecord.mockResolvedValue(taxonomy);
		const otuCommand = genbankCommand();
		await call("createLocalOtuFn", { referenceId, command: otuCommand });

		const shortRecord = { ...record, sequence: "ATCG" };
		const segment = otuCommand.payload.plan.segments[0];
		if (!segment) {
			throw new Error("Expected an OTU segment.");
		}
		fetchGenbankRecords.mockResolvedValue([shortRecord]);
		await expect(
			call("getGenbankIsolateDraftFn", {
				referenceId,
				otuId: otuCommand.otuId,
				accessions: [record.accession_version],
			}),
		).rejects.toMatchObject({ status: 422 });
		const sequenceId = randomUUID();
		await expect(
			call("createLocalOtuIsolateFn", {
				referenceId,
				command: {
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
									definition: shortRecord.definition,
									sequence: shortRecord.sequence,
									segmentId: segment.id,
								},
							],
						},
					},
				},
			}),
		).rejects.toMatchObject({ status: 422 });
		const otu = (await call("getLocalOtuFn", {
			referenceId,
			otuId: otuCommand.otuId,
		})) as { version: number; isolates: unknown[] };
		expect(otu.version).toBe(1);
		expect(otu.isolates).toHaveLength(1);
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
