import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { groups } from "../db/schema/groups";
import { instruments } from "../db/schema/instruments";
import { runs } from "../db/schema/runs";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { addToGroup, seedGroup } from "../groups/test/fixtures";
import { upsertInstrumentAndRun } from "../runs/data";
import {
	canCreateFromInstrument,
	createInstrument,
	deleteInstrument,
	findInstruments,
	getInstrument,
	InstrumentConflictError,
	InstrumentGroupNotFoundError,
	InstrumentInUseError,
	InstrumentNotFoundError,
	updateInstrument,
} from "./data";

let database: TestDatabase;
let db: Db;

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
});

describe("createInstrument", () => {
	it("infers the model and names the instrument after its serial", async () => {
		const instrument = await createInstrument(db, { serial: "M01234" });

		expect(instrument).toMatchObject({
			groups: [],
			model: "MiSeq",
			name: "M01234",
			serial: "M01234",
		});
	});

	it("keeps a model the caller supplies", async () => {
		const instrument = await createInstrument(db, {
			model: null,
			name: "Bench MiSeq",
			serial: "M01234",
		});

		expect(instrument).toMatchObject({ model: null, name: "Bench MiSeq" });
	});

	it("rejects a serial that is already recorded", async () => {
		await createInstrument(db, { serial: "M01234" });

		await expect(
			createInstrument(db, { serial: "M01234" }),
		).rejects.toBeInstanceOf(InstrumentConflictError);
	});
});

describe("updateInstrument", () => {
	it("replaces the owning groups", async () => {
		const { id } = await createInstrument(db, { serial: "M01234" });
		const bench = await seedGroup(db, { name: "bench" });
		const core = await seedGroup(db, { name: "core" });

		await updateInstrument(db, id, { groups: [bench, core] });
		const updated = await updateInstrument(db, id, {
			groups: [core],
			name: "Core MiSeq",
		});

		expect(updated.name).toBe("Core MiSeq");
		expect(updated.groups.map((group) => group.id)).toEqual([core]);
		expect((await findInstruments(db))[0]?.groups).toHaveLength(1);
	});

	it("replaces the owning groups when every other field is undefined", async () => {
		const { id } = await createInstrument(db, { serial: "M01234" });
		const bench = await seedGroup(db, { name: "bench" });
		const core = await seedGroup(db, { name: "core" });
		await updateInstrument(db, id, { groups: [bench] });

		const updated = await updateInstrument(db, id, {
			groups: [core],
			model: undefined,
			name: undefined,
		});

		expect(updated.name).toBe("M01234");
		expect(updated.groups.map((group) => group.id)).toEqual([core]);
	});

	it("returns the instrument unchanged when no field is set", async () => {
		const { id } = await createInstrument(db, { serial: "M01234" });

		const updated = await updateInstrument(db, id, { name: undefined });

		expect(updated).toMatchObject({ id, groups: [], name: "M01234" });
	});

	it("rejects a group that does not exist", async () => {
		const { id } = await createInstrument(db, { serial: "M01234" });

		await expect(
			updateInstrument(db, id, { groups: [987654] }),
		).rejects.toBeInstanceOf(InstrumentGroupNotFoundError);
	});

	it("throws when the instrument does not exist", async () => {
		await expect(
			updateInstrument(db, 987654, { name: "Gone" }),
		).rejects.toBeInstanceOf(InstrumentNotFoundError);
		await expect(
			updateInstrument(db, 987654, { groups: [] }),
		).rejects.toBeInstanceOf(InstrumentNotFoundError);
		await expect(
			updateInstrument(db, 987654, { name: undefined }),
		).rejects.toBeInstanceOf(InstrumentNotFoundError);
	});
});

describe("deleteInstrument", () => {
	it("deletes an instrument with no runs", async () => {
		const { id } = await createInstrument(db, { serial: "M01234" });

		await deleteInstrument(db, id);

		await expect(getInstrument(db, id)).rejects.toBeInstanceOf(
			InstrumentNotFoundError,
		);
	});

	it("refuses to delete an instrument with runs", async () => {
		const userId = await seedUser(db);
		const { instrumentId } = await upsertInstrumentAndRun(
			db,
			{ flowcell: "000000000-A1B2C", instrument: "M01234", runNumber: 7 },
			userId,
		);

		await expect(deleteInstrument(db, instrumentId)).rejects.toBeInstanceOf(
			InstrumentInUseError,
		);
	});
});

describe("canCreateFromInstrument", () => {
	it("allows anyone when the instrument is unowned", async () => {
		const userId = await seedUser(db);
		const { id } = await createInstrument(db, { serial: "M01234" });

		expect(await canCreateFromInstrument(db, userId, id)).toBe(true);
	});

	it("allows only members of an owning group when the instrument is owned", async () => {
		const member = await seedUser(db, { handle: "member" });
		const outsider = await seedUser(db, { handle: "outsider" });
		const loner = await seedUser(db, { handle: "loner" });
		const bench = await seedGroup(db, { name: "bench" });
		const core = await seedGroup(db, { name: "core" });
		const other = await seedGroup(db, { name: "other" });
		await addToGroup(db, member, core);
		await addToGroup(db, outsider, other);
		const { id } = await createInstrument(db, { serial: "M01234" });
		await updateInstrument(db, id, { groups: [bench, core] });

		expect(await canCreateFromInstrument(db, member, id)).toBe(true);
		expect(await canCreateFromInstrument(db, outsider, id)).toBe(false);
		expect(await canCreateFromInstrument(db, loner, id)).toBe(false);
	});
});
