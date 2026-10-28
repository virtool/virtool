import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { groups } from "../db/schema/groups";
import { instruments } from "../db/schema/instruments";
import { runs } from "../db/schema/runs";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { addToGroup, seedGroup } from "../groups/test/fixtures";
import { updateInstrument } from "../instruments/data";
import { collectFrames } from "../test/frames";
import {
	type CreateRunValues,
	claimRun,
	createRun,
	findRuns,
	getRun,
	listRunsForUser,
	RunAlreadyClaimedError,
	RunClaimForbiddenError,
	RunGroupNotFoundError,
	RunNotFoundError,
	RunTechnicianNotFoundError,
	updateRun,
	upsertInstrumentAndRun,
} from "./data";

let database: TestDatabase;
let db: Db;
let userId: number;

const identity = {
	flowcell: "000000000-A1B2C",
	instrument: "M01234",
	runNumber: 7,
};

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(runs);
	await db.delete(instruments);
	await db.delete(groups);
	await db.delete(users);
	userId = await seedUser(db);
});

function values(overrides: Partial<CreateRunValues> = {}): CreateRunValues {
	return {
		autoCreate: true,
		entries: [],
		groupId: null,
		libraryType: "normal",
		name: "Run 1",
		technicianId: null,
		userId,
		...overrides,
	};
}

function entry(sheetSampleId: string, sampleName: string | null = null) {
	return {
		index: "ACGT",
		index2: null,
		sampleName,
		sampleProject: null,
		sheetSampleId,
	};
}

describe("createRun", () => {
	it("declares a run with its defaults and sheet entries", async () => {
		const groupId = await seedGroup(db, { name: "bench" });

		const run = await createRun(
			db,
			values({
				entries: [entry("S1", "Leaf"), entry("S2")],
				groupId,
				libraryType: "amplicon",
			}),
		);

		expect(run).toMatchObject({
			autoCreate: true,
			flowcell: null,
			group: { id: groupId, name: "bench" },
			instrument: null,
			libraryType: "amplicon",
			origin: "declared",
			runNumber: null,
			technician: null,
			user: { id: userId, handle: "alice" },
		});
		expect(run.entries.map((e) => [e.sheetSampleId, e.sampleName])).toEqual([
			["S1", "Leaf"],
			["S2", null],
		]);
		expect(run.entries[0]).toMatchObject({
			claimedAt: null,
			error: null,
			sample: null,
		});
	});

	it("collapses lane rows into one entry per sheet sample id", async () => {
		const run = await createRun(
			db,
			values({ entries: [entry("S1", "Lane 1"), entry("S1", "Lane 2")] }),
		);

		expect(run.entries.map((e) => e.sampleName)).toEqual(["Lane 1"]);
	});

	it("emits a runs create event", async () => {
		let runId = 0;

		const frames = await collectFrames(database.client, async () => {
			runId = (await createRun(db, values())).id;
		});

		expect(frames).toEqual([
			{ domain: "runs", resource_id: runId, operation: "create" },
		]);
	});

	it("rejects a group or technician that does not exist", async () => {
		await expect(
			createRun(db, values({ groupId: 987654 })),
		).rejects.toBeInstanceOf(RunGroupNotFoundError);
		await expect(
			createRun(db, values({ technicianId: 987654 })),
		).rejects.toBeInstanceOf(RunTechnicianNotFoundError);
	});
});

describe("upsertInstrumentAndRun", () => {
	it("records a new instrument and detected run once", async () => {
		const [first, second] = await Promise.all([
			upsertInstrumentAndRun(db, identity, userId),
			upsertInstrumentAndRun(db, identity, userId),
		]);

		expect(second).toEqual(first);

		const run = await getRun(db, first.runId);

		expect(run).toMatchObject({
			flowcell: identity.flowcell,
			instrument: { id: first.instrumentId, serial: "M01234" },
			origin: "detected",
			runNumber: 7,
			user: { id: userId },
		});
	});

	it("reuses the instrument for a new run", async () => {
		const first = await upsertInstrumentAndRun(db, identity, userId);
		const second = await upsertInstrumentAndRun(
			db,
			{ ...identity, runNumber: 8 },
			userId,
		);

		expect(second.instrumentId).toBe(first.instrumentId);
		expect(second.runId).not.toBe(first.runId);
	});
});

describe("findRuns", () => {
	it("pages runs newest first and matches the name or flowcell", async () => {
		await createRun(db, values({ name: "Spring" }));
		await upsertInstrumentAndRun(db, identity, userId);
		await createRun(db, values({ name: "Autumn" }));

		const all = await findRuns(db, { page: 1, perPage: 2, term: "" });

		expect(all).toMatchObject({
			foundCount: 3,
			page: 1,
			pageCount: 2,
			perPage: 2,
			totalCount: 3,
		});
		expect(all.items.map((run) => run.name)).toEqual([
			"Autumn",
			"M01234_7_000000000-A1B2C",
		]);

		const byFlowcell = await findRuns(db, {
			page: 1,
			perPage: 25,
			term: "a1b2",
		});

		expect(byFlowcell.items.map((run) => run.origin)).toEqual(["detected"]);
		expect(byFlowcell.totalCount).toBe(3);
	});
});

describe("updateRun", () => {
	it("sets and clears the technician", async () => {
		const technicianId = await seedUser(db, { handle: "tech" });
		const { id } = await createRun(db, values());

		const set = await updateRun(db, id, { technicianId, name: "Renamed" });
		const cleared = await updateRun(db, id, { technicianId: null });

		expect(set.technician).toEqual({ id: technicianId, handle: "tech" });
		expect(set.name).toBe("Renamed");
		expect(cleared.technician).toBeNull();
	});

	it("throws when the run does not exist", async () => {
		await expect(
			updateRun(db, 987654, { name: "Gone" }),
		).rejects.toBeInstanceOf(RunNotFoundError);
		await expect(
			updateRun(db, 987654, { technicianId: userId }),
		).rejects.toBeInstanceOf(RunNotFoundError);
	});

	it("assigns a technician on an owned instrument only from an owning group", async () => {
		const outsider = await seedUser(db, { handle: "bob" });
		const bench = await seedGroup(db, { name: "bench" });
		await addToGroup(db, userId, bench);
		const { instrumentId, runId } = await upsertInstrumentAndRun(
			db,
			identity,
			userId,
		);
		await updateInstrument(db, instrumentId, { groups: [bench] });

		await expect(
			updateRun(db, runId, { technicianId: outsider }),
		).rejects.toBeInstanceOf(RunClaimForbiddenError);
		expect((await getRun(db, runId)).technician).toBeNull();

		const assigned = await updateRun(db, runId, { technicianId: userId });

		expect(assigned.technician?.id).toBe(userId);

		const cleared = await updateRun(db, runId, { technicianId: null });

		expect(cleared.technician).toBeNull();
	});

	it("accepts any technician on a run without an instrument", async () => {
		const outsider = await seedUser(db, { handle: "bob" });
		const { id } = await createRun(db, values());

		const assigned = await updateRun(db, id, { technicianId: outsider });

		expect(assigned.technician).toEqual({ id: outsider, handle: "bob" });
	});
});

describe("claimRun", () => {
	it("makes the caller the technician of an unclaimed run", async () => {
		const { runId } = await upsertInstrumentAndRun(db, identity, userId);

		const run = await claimRun(db, runId, userId);

		expect(run.technician).toEqual({ id: userId, handle: "alice" });
	});

	it("refuses a run that already has a technician", async () => {
		const other = await seedUser(db, { handle: "bob" });
		const { id } = await createRun(db, values({ technicianId: other }));

		await expect(claimRun(db, id, userId)).rejects.toBeInstanceOf(
			RunAlreadyClaimedError,
		);
	});

	it("allows only members of an owning group on an owned instrument", async () => {
		const outsider = await seedUser(db, { handle: "bob" });
		const bench = await seedGroup(db, { name: "bench" });
		await addToGroup(db, userId, bench);
		const { instrumentId, runId } = await upsertInstrumentAndRun(
			db,
			identity,
			userId,
		);
		await updateInstrument(db, instrumentId, { groups: [bench] });

		await expect(claimRun(db, runId, outsider)).rejects.toBeInstanceOf(
			RunClaimForbiddenError,
		);
		expect((await claimRun(db, runId, userId)).technician?.id).toBe(userId);
	});
});

describe("listRunsForUser", () => {
	it("lists the runs a user is the technician of", async () => {
		const other = await seedUser(db, { handle: "bob" });
		await createRun(db, values({ name: "Mine", technicianId: userId }));
		await createRun(db, values({ name: "Theirs", technicianId: other }));
		await createRun(db, values({ name: "Nobody's" }));

		const listed = await listRunsForUser(db, userId);

		expect(listed.map((run) => run.name)).toEqual(["Mine"]);
	});
});
