import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { labels } from "../db/schema/labels";
import { legacySampleLabels, legacySamples } from "../db/schema/samples";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	createLabel,
	deleteLabel,
	findLabels,
	getLabel,
	LabelNotFoundError,
	updateLabel,
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
	await db.delete(legacySamples);
	await db.delete(labels);
	await db.delete(users);
});

async function seedLabel(name: string): Promise<number> {
	return (await createLabel(db, { color: "#A0AEC0", description: "", name }))
		.id;
}

async function seedLabelledSample(
	name: string,
	labelIds: number[],
): Promise<number> {
	const userId = await seedUser(db, { handle: `owner-${name}` });
	const sampleId = takeFirstOrThrow(
		await db
			.insert(legacySamples)
			.values({
				name,
				library_type: "normal",
				created_at: new Date(),
				user_id: userId,
			})
			.returning({ id: legacySamples.id }),
	).id;

	if (labelIds.length) {
		await db
			.insert(legacySampleLabels)
			.values(
				labelIds.map((labelId) => ({ sample_id: sampleId, label_id: labelId })),
			);
	}

	return sampleId;
}

describe("findLabels", () => {
	it("matches % and _ in the term literally", async () => {
		await seedLabel("50% done");
		await seedLabel("50 done");
		await seedLabel("to_do");
		await seedLabel("to-do");

		const percent = await findLabels(db, "0%");
		const underscore = await findLabels(db, "o_d");

		expect(percent.map((label) => label.name)).toEqual(["50% done"]);
		expect(underscore.map((label) => label.name)).toEqual(["to_do"]);
	});
});

describe("sample counts", () => {
	it("counts the samples carrying each label", async () => {
		const bug = await seedLabel("Bug");
		const fungus = await seedLabel("Fungus");
		await seedLabel("Unused");
		await seedLabelledSample("A", [bug, fungus]);
		await seedLabelledSample("B", [bug]);

		const found = await findLabels(db);

		expect(found.map(({ name, count }) => ({ name, count }))).toEqual([
			{ name: "Bug", count: 2 },
			{ name: "Fungus", count: 1 },
			{ name: "Unused", count: 0 },
		]);
		expect((await getLabel(db, bug)).count).toBe(2);
	});

	it("keeps the count when a label is updated", async () => {
		const bug = await seedLabel("Bug");
		await seedLabelledSample("A", [bug]);

		const updated = await updateLabel(db, bug, { name: "Insect" });

		expect(updated).toMatchObject({ name: "Insect", count: 1 });
	});
});

describe("deleteLabel", () => {
	it("deletes a label still on samples and removes it from them", async () => {
		const bug = await seedLabel("Bug");
		const fungus = await seedLabel("Fungus");
		const sampleId = await seedLabelledSample("A", [bug, fungus]);

		await deleteLabel(db, bug);

		await expect(getLabel(db, bug)).rejects.toBeInstanceOf(LabelNotFoundError);
		expect(
			await db
				.select({ labelId: legacySampleLabels.label_id })
				.from(legacySampleLabels)
				.where(eq(legacySampleLabels.sample_id, sampleId)),
		).toEqual([{ labelId: fungus }]);
		expect(
			await db
				.select()
				.from(legacySamples)
				.where(eq(legacySamples.id, sampleId)),
		).toHaveLength(1);
	});

	it("throws when the label does not exist", async () => {
		await expect(deleteLabel(db, 404)).rejects.toBeInstanceOf(
			LabelNotFoundError,
		);
	});
});
