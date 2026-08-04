// Round-trip budgets for the OTU endpoints.
//
// These assert a cost, not a behaviour, and they exist because the redundancy
// they pin is invisible from the outside: reading the same `legacy_otus` row
// four times to serve one write is correct, passes every other test in this
// directory, and only shows up as latency. An exact count fails loudly when a
// helper starts reading something a caller already holds.
//
// Raise a number here deliberately, with a reason. Reaching for a row that is
// already in hand is what these are here to catch.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { legacyHistory, legacyHistoryDiff } from "../db/schema/history";
import { legacyOtus, legacySequences } from "../db/schema/otus";
import { legacyReferences } from "../db/schema/references";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createIsolate,
	createOtu,
	createSequence,
	deleteSequence,
	findOtus,
	getOtu,
	updateOtu,
} from "./data";

let database: TestDatabase;
let db: Db;
let referenceId: number;
let userId: number;

const statements: string[] = [];

// `BEGIN`/`COMMIT` are counted separately from the statements that do the work,
// so a budget describes reads and writes rather than transaction framing.
function isTransactionControl(query: string): boolean {
	return /^\s*(begin|commit|rollback)/i.test(query);
}

async function countQueries(run: () => Promise<unknown>): Promise<number> {
	statements.length = 0;
	await run();

	return statements.filter((query) => !isTransactionControl(query)).length;
}

beforeAll(async () => {
	database = await createTestDatabase({
		onQuery: (query) => statements.push(query),
	});
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacyHistoryDiff);
	await db.delete(legacyHistory);
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(legacyReferences);
	await db.delete(users);

	const [user] = await db
		.insert(users)
		.values({
			handle: "leeashley",
			lastPasswordChange: new Date(),
			password: Buffer.from("x"),
			settings: {},
		})
		.returning({ id: users.id });

	userId = user?.id as number;

	const [reference] = await db
		.insert(legacyReferences)
		.values({ name: "Reference" })
		.returning({ id: legacyReferences.id });

	referenceId = reference?.id as number;
});

describe("read budgets", () => {
	it("serves an OTU detail in three queries", async () => {
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Budget", abbreviation: "", schema: [] },
			userId,
		);

		// The OTU with its reference, its sequences, and its most recent change.
		expect(await countQueries(() => getOtu(db, otu.id))).toBe(3);
	});

	it("serves a page of OTUs in three queries", async () => {
		await createOtu(
			db,
			referenceId,
			{ name: "Budget", abbreviation: "", schema: [] },
			userId,
		);

		// Reference existence with both counts, the page itself, and the
		// unbuilt-change count.
		expect(
			await countQueries(() =>
				findOtus(db, referenceId, { page: 1, perPage: 25, term: "" }),
			),
		).toBe(3);
	});

	it("costs no more to search than to list", async () => {
		await createOtu(
			db,
			referenceId,
			{ name: "Budget", abbreviation: "", schema: [] },
			userId,
		);

		expect(
			await countQueries(() =>
				findOtus(db, referenceId, { page: 1, perPage: 25, term: "budg" }),
			),
		).toBe(3);
	});
});

describe("write budgets", () => {
	async function seedIsolate() {
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Budget", abbreviation: "", schema: [] },
			userId,
		);

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		return { otuId: otu.id, isolateId: isolate.id };
	}

	it("adds an isolate without re-reading the OTU", async () => {
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Budget", abbreviation: "", schema: [] },
			userId,
		);

		// Locked read (2), the OTU write, the re-join (2), the two history rows.
		// Re-verification issues nothing: a newly added isolate has no sequences,
		// so the OTU still fails and the version bump already cleared `verified`.
		expect(
			await countQueries(() =>
				createIsolate(
					db,
					otu.id,
					{ default: true, sourceName: "Ever", sourceType: "isolate" },
					userId,
				),
			),
		).toBe(7);
	});

	it("adds a sequence without re-reading the OTU", async () => {
		const { otuId, isolateId } = await seedIsolate();

		expect(
			await countQueries(() =>
				createSequence(
					db,
					otuId,
					isolateId,
					{
						accession: "NC_112201",
						definition: "A made up sequence",
						host: "okra",
						segment: null,
						sequence: "ATGCGTGTACTG",
					},
					userId,
				),
			),
		).toBe(10);
	});

	it("does not pay for a segment check with a query", async () => {
		const otu = await createOtu(
			db,
			referenceId,
			{
				name: "Segmented",
				abbreviation: "",
				schema: [{ molecule: null, name: "DNA A", required: true }],
			},
			userId,
		);

		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		const values = {
			accession: "NC_112201",
			definition: "A made up sequence",
			host: "okra",
			sequence: "ATGCGTGTACTG",
		};

		const withoutSegment = await countQueries(() =>
			createSequence(
				db,
				otu.id,
				isolate.id,
				{ ...values, segment: null },
				userId,
			),
		);

		const withSegment = await countQueries(() =>
			createSequence(
				db,
				otu.id,
				isolate.id,
				{ ...values, accession: "OTHER", segment: "DNA A" },
				userId,
			),
		);

		// The schema comes off the document the locked read already returned.
		expect(withSegment).toBe(withoutSegment);
	});

	it("returns the edited OTU without a second reference lookup", async () => {
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Budget", abbreviation: "", schema: [] },
			userId,
		);

		// Locked read (2), the write, the segment sweep is skipped, the re-join
		// (2), verification, two history rows, then the response read (3).
		expect(
			await countQueries(() =>
				updateOtu(db, otu.id, { name: "Renamed" }, userId),
			),
		).toBe(11);
	});

	it("deletes a sequence in eight queries", async () => {
		const { otuId, isolateId } = await seedIsolate();

		const sequence = await createSequence(
			db,
			otuId,
			isolateId,
			{
				accession: "NC_112201",
				definition: "A made up sequence",
				host: "okra",
				segment: null,
				sequence: "ATGCGTGTACTG",
			},
			userId,
		);

		expect(
			await countQueries(() =>
				deleteSequence(db, otuId, isolateId, sequence.id, userId),
			),
		).toBe(8);
	});
});
