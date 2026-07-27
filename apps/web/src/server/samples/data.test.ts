import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { analyses } from "../db/schema/analyses";
import { groups, userGroups } from "../db/schema/groups";
import { jobs } from "../db/schema/jobs";
import { labels } from "../db/schema/labels";
import {
	legacySampleLabels,
	legacySampleSubtractions,
	legacySamples,
	sampleArtifacts,
	sampleReads,
	sampleUploads,
} from "../db/schema/samples";
import { subtractions } from "../db/schema/subtractions";
import { uploads } from "../db/schema/uploads";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { addToGroup, seedGroup } from "../groups/test/fixtures";
import { MemoryStorage } from "../storage";
import { UploadNotFoundError } from "../uploads/data";
import {
	type CreateSampleValues,
	checkSampleRight,
	createSample,
	deleteSample,
	findSamples,
	getSample,
	hasSampleRight,
	resolveSampleActor,
	type SampleActor,
	SampleFileDuplicateError,
	SampleGroupNotFoundError,
	SampleLabelsNotFoundError,
	SampleNameConflictError,
	SampleNotFoundError,
	SampleOwnerlessError,
	sampleReadableFilter,
	updateSample,
	updateSampleRights,
} from "./data";

let database: TestDatabase;
let db: Db;
let ownerId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(analyses);
	await db.delete(legacySampleLabels);
	await db.delete(legacySampleSubtractions);
	await db.delete(sampleUploads);
	await db.delete(sampleArtifacts);
	await db.delete(sampleReads);
	await db.delete(legacySamples);
	await db.delete(jobs);
	await db.delete(labels);
	await db.delete(subtractions);
	await db.delete(uploads);
	await db.delete(userGroups);
	await db.delete(groups);
	await db.delete(users);

	ownerId = await seedUser(db, { handle: "owner" });
});

async function seedSample(
	overrides: Partial<typeof legacySamples.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(legacySamples)
			.values({
				name: "Sample",
				library_type: "normal",
				created_at: new Date(),
				user_id: ownerId,
				...overrides,
			})
			.returning({ id: legacySamples.id }),
	).id;
}

async function seedLabel(name: string): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(labels)
			.values({ name, color: "#000000", description: "" })
			.returning({ id: labels.id }),
	).id;
}

async function seedSubtraction(name: string): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(subtractions)
			.values({ name })
			.returning({ id: subtractions.id }),
	).id;
}

async function seedUpload(reserved = false): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(uploads)
			.values({
				createdAt: new Date(),
				name: "reads.fq.gz",
				nameOnDisk: `disk-${Math.random()}`,
				type: "reads",
				ready: true,
				reserved,
				userId: ownerId,
			})
			.returning({ id: uploads.id }),
	).id;
}

const adminActor: SampleActor = { userId: 999, groupIds: [], isAdmin: true };

describe("hasSampleRight", () => {
	const row = {
		all_read: false,
		all_write: false,
		group_read: false,
		group_write: false,
		group_id: 5,
		user_id: 1,
	};

	it("grants an administrator every right", () => {
		const actor: SampleActor = { userId: 2, groupIds: [], isAdmin: true };
		expect(hasSampleRight(row, actor, "read")).toBe(true);
		expect(hasSampleRight(row, actor, "write")).toBe(true);
	});

	it("grants the owner every right", () => {
		const actor: SampleActor = { userId: 1, groupIds: [], isAdmin: false };
		expect(hasSampleRight(row, actor, "read")).toBe(true);
		expect(hasSampleRight(row, actor, "write")).toBe(true);
	});

	it("grants everyone read when all_read is set", () => {
		const actor: SampleActor = { userId: 2, groupIds: [], isAdmin: false };
		expect(hasSampleRight({ ...row, all_read: true }, actor, "read")).toBe(
			true,
		);
		expect(hasSampleRight({ ...row, all_read: true }, actor, "write")).toBe(
			false,
		);
	});

	it("grants a group member read only through group_read", () => {
		const member: SampleActor = { userId: 2, groupIds: [5], isAdmin: false };
		const outsider: SampleActor = { userId: 2, groupIds: [6], isAdmin: false };
		const groupReadable = { ...row, group_read: true };
		expect(hasSampleRight(groupReadable, member, "read")).toBe(true);
		expect(hasSampleRight(groupReadable, outsider, "read")).toBe(false);
	});

	it("denies a non-owner, non-member with no world rights", () => {
		const actor: SampleActor = { userId: 2, groupIds: [], isAdmin: false };
		expect(hasSampleRight(row, actor, "read")).toBe(false);
	});
});

describe("checkSampleRight", () => {
	it("allows a lookup for a nonexistent sample so the fetch 404s", async () => {
		const actor = await resolveSampleActor(db, ownerId);
		expect(await checkSampleRight(db, 123456, actor, "read")).toBe(true);
	});

	it("denies a non-owner without world or group rights", async () => {
		const sampleId = await seedSample({ all_read: false });
		const other = await seedUser(db, { handle: "other" });
		const actor = await resolveSampleActor(db, other);
		expect(await checkSampleRight(db, sampleId, actor, "read")).toBe(false);
	});
});

describe("findSamples", () => {
	const options = {
		page: 1,
		perPage: 25,
		term: "",
		labels: [],
		users: [],
		workflows: [],
	};

	it("scopes a non-admin to their own, world-readable, and group-readable samples", async () => {
		const groupId = await seedGroup(db, { name: "techs" });
		const other = await seedUser(db, { handle: "other" });
		await addToGroup(db, other, groupId);

		const own = await seedSample({ user_id: other, name: "Own" });
		const world = await seedSample({
			user_id: ownerId,
			all_read: true,
			name: "World",
		});
		const groupReadable = await seedSample({
			user_id: ownerId,
			group_id: groupId,
			group_read: true,
			name: "Group",
		});
		await seedSample({ user_id: ownerId, name: "Hidden" });

		const actor = await resolveSampleActor(db, other);
		const result = await findSamples(db, options, actor);

		expect(new Set(result.items.map((s) => s.id))).toEqual(
			new Set([own, world, groupReadable]),
		);
	});

	it("returns every sample for an administrator", async () => {
		await seedSample({ name: "A" });
		await seedSample({ name: "B" });

		const result = await findSamples(db, options, adminActor);

		expect(result.items).toHaveLength(2);
	});

	it("reports the unscoped total but the scoped found count", async () => {
		await seedSample({ user_id: ownerId, name: "Mine" });
		const stranger = await seedUser(db, { handle: "stranger" });
		await seedSample({ user_id: stranger, name: "Theirs" });

		const actor = await resolveSampleActor(db, ownerId);
		const result = await findSamples(db, options, actor);

		expect(result.totalCount).toBe(2);
		expect(result.foundCount).toBe(1);
	});

	it("filters by a case-insensitive name substring", async () => {
		await seedSample({ name: "Apple" });
		await seedSample({ name: "Banana" });

		const result = await findSamples(
			db,
			{ ...options, term: "app" },
			adminActor,
		);

		expect(result.items.map((s) => s.name)).toEqual(["Apple"]);
	});

	it("filters by owner", async () => {
		const other = await seedUser(db, { handle: "other" });
		await seedSample({ user_id: ownerId, name: "Mine" });
		await seedSample({ user_id: other, name: "Theirs" });

		const result = await findSamples(
			db,
			{ ...options, users: [other] },
			adminActor,
		);

		expect(result.items.map((s) => s.name)).toEqual(["Theirs"]);
	});

	it("filters by label", async () => {
		const labelId = await seedLabel("important");
		const labelled = await seedSample({ name: "Labelled" });
		await seedSample({ name: "Plain" });
		await db
			.insert(legacySampleLabels)
			.values({ sample_id: labelled, label_id: labelId });

		const result = await findSamples(
			db,
			{ ...options, labels: [labelId] },
			adminActor,
		);

		expect(result.items.map((s) => s.id)).toEqual([labelled]);
	});
});

describe("workflow tags and filtering", () => {
	it("derives tags from a sample's analyses", async () => {
		const readyNuvs = await seedSample({ name: "Ready" });
		await db
			.insert(analyses)
			.values({ sample_id: readyNuvs, workflow: "nuvs", ready: true });

		const pendingPatho = await seedSample({ name: "Pending" });
		await db.insert(analyses).values({
			sample_id: pendingPatho,
			workflow: "pathoscope",
			ready: false,
		});

		const noneSample = await seedSample({ name: "None" });

		const result = await findSamples(
			db,
			{ page: 1, perPage: 25, term: "", labels: [], users: [], workflows: [] },
			adminActor,
		);
		const byId = new Map(result.items.map((s) => [s.id, s]));

		expect(byId.get(readyNuvs)?.nuvs).toBe(true);
		expect(byId.get(readyNuvs)?.workflows.nuvs).toBe("complete");
		expect(byId.get(pendingPatho)?.pathoscope).toBe("ip");
		expect(byId.get(pendingPatho)?.workflows.pathoscope).toBe("pending");
		expect(byId.get(noneSample)?.nuvs).toBe(false);
		expect(byId.get(noneSample)?.workflows.nuvs).toBe("none");
	});

	it("filters by a workflow:condition pair", async () => {
		const ready = await seedSample({ name: "Ready" });
		await db
			.insert(analyses)
			.values({ sample_id: ready, workflow: "nuvs", ready: true });
		await seedSample({ name: "NoAnalyses" });

		const result = await findSamples(
			db,
			{
				page: 1,
				perPage: 25,
				term: "",
				labels: [],
				users: [],
				workflows: ["nuvs:ready"],
			},
			adminActor,
		);

		expect(result.items.map((s) => s.id)).toEqual([ready]);
	});

	it("drops unrecognized workflow filters rather than matching everything", async () => {
		await seedSample({ name: "A" });
		await seedSample({ name: "B" });

		const result = await findSamples(
			db,
			{
				page: 1,
				perPage: 25,
				term: "",
				labels: [],
				users: [],
				workflows: ["bogus:none"],
			},
			adminActor,
		);

		expect(result.items).toHaveLength(2);
	});
});

describe("getSample", () => {
	it("returns the full sample shape", async () => {
		const groupId = await seedGroup(db, { name: "g" });
		const labelId = await seedLabel("lab");
		const subtractionId = await seedSubtraction("sub");
		const sampleId = await seedSample({
			name: "Full",
			group_id: groupId,
			quality: { count: 1 } as never,
		});

		await db
			.insert(legacySampleLabels)
			.values({ sample_id: sampleId, label_id: labelId });
		await db
			.insert(legacySampleSubtractions)
			.values({ sample_id: sampleId, subtraction_id: subtractionId });
		await db.insert(sampleReads).values([
			{
				sample: String(sampleId),
				sample_id: sampleId,
				name: "reads_1.fq.gz",
				name_on_disk: "reads_1.fq.gz",
			},
			{
				sample: String(sampleId),
				sample_id: sampleId,
				name: "reads_2.fq.gz",
				name_on_disk: "reads_2.fq.gz",
			},
		]);

		const sample = await getSample(db, sampleId);

		expect(sample.labels.map((l) => l.id)).toEqual([labelId]);
		expect(sample.subtractions.map((s) => s.id)).toEqual([subtractionId]);
		expect(sample.group?.id).toBe(groupId);
		expect(sample.quality).toEqual({ count: 1 });
		expect(sample.reads).toHaveLength(2);
		expect(sample.paired).toBe(true);
		expect(sample.user.id).toBe(ownerId);
	});

	it("loads reads and artifacts keyed by the legacy storage id", async () => {
		const sampleId = await seedSample({ legacy_id: "abc123" });

		// A legacy row is keyed only by the text `sample` storage id, with
		// `sample_id` left null.
		await db.insert(sampleReads).values({
			sample: "abc123",
			sample_id: null,
			name: "reads_1.fq.gz",
			name_on_disk: "reads_1.fq.gz",
		});
		await db.insert(sampleArtifacts).values({
			sample: "abc123",
			sample_id: null,
			name: "fastqc.txt",
			type: "fastqc",
		});

		const sample = await getSample(db, sampleId);

		expect(sample.reads.map((r) => r.name)).toEqual(["reads_1.fq.gz"]);
		expect(sample.artifacts.map((a) => a.name)).toEqual(["fastqc.txt"]);
	});

	it("throws when the sample does not exist", async () => {
		await expect(getSample(db, 123456)).rejects.toBeInstanceOf(
			SampleNotFoundError,
		);
	});

	it("throws when the sample has no owner", async () => {
		const sampleId = await seedSample({ user_id: null });
		await expect(getSample(db, sampleId)).rejects.toBeInstanceOf(
			SampleOwnerlessError,
		);
	});
});

describe("createSample", () => {
	function values(
		overrides: Partial<CreateSampleValues> = {},
	): CreateSampleValues {
		return {
			name: "New Sample",
			host: "",
			isolate: "",
			locale: "",
			notes: "",
			libraryType: "normal",
			group: null,
			subtractions: [],
			labels: [],
			files: [],
			userId: ownerId,
			...overrides,
		};
	}

	it("creates a pending job, reserves the uploads, and links them in order", async () => {
		const first = await seedUpload();
		const second = await seedUpload();

		const sample = await createSample(db, values({ files: [first, second] }));

		// `paired` is derived from the reads on read, which are not uploaded until
		// the job runs, so the stored column is what create sets from the file count.
		const [row] = await db
			.select({ paired: legacySamples.paired })
			.from(legacySamples)
			.where(eq(legacySamples.id, sample.id));
		expect(row?.paired).toBe(true);

		const [job] = await db
			.select()
			.from(jobs)
			.where(eq(jobs.id, sample.job?.id ?? 0));
		expect(job?.workflow).toBe("create_sample");
		expect(job?.state).toBe("pending");

		const reserved = await db
			.select({ id: uploads.id, reserved: uploads.reserved })
			.from(uploads);
		expect(reserved.every((u) => u.reserved)).toBe(true);

		const links = await db
			.select()
			.from(sampleUploads)
			.where(eq(sampleUploads.sample_id, sample.id))
			.orderBy(sampleUploads.index);
		expect(links.map((l) => l.upload_id)).toEqual([first, second]);
	});

	it("inserts the label and subtraction join rows", async () => {
		const file = await seedUpload();
		const labelId = await seedLabel("lab");
		const subtractionId = await seedSubtraction("sub");

		const sample = await createSample(
			db,
			values({
				files: [file],
				labels: [labelId],
				subtractions: [subtractionId],
			}),
		);

		expect(sample.labels.map((l) => l.id)).toEqual([labelId]);
		expect(sample.subtractions.map((s) => s.id)).toEqual([subtractionId]);
	});

	it("rejects a duplicate name", async () => {
		await seedSample({ name: "Taken" });
		await expect(
			createSample(db, values({ name: "Taken" })),
		).rejects.toBeInstanceOf(SampleNameConflictError);
	});

	it("rejects a duplicated upload", async () => {
		const file = await seedUpload();
		await expect(
			createSample(db, values({ files: [file, file] })),
		).rejects.toBeInstanceOf(SampleFileDuplicateError);
	});

	it("rejects a missing label", async () => {
		const file = await seedUpload();
		await expect(
			createSample(db, values({ files: [file], labels: [987654] })),
		).rejects.toBeInstanceOf(SampleLabelsNotFoundError);
	});

	it("rejects a file that is not a visible reads upload", async () => {
		const reference = takeFirstOrThrow(
			await db
				.insert(uploads)
				.values({
					createdAt: new Date(),
					name: "ref.fa.gz",
					nameOnDisk: `disk-ref-${Math.random()}`,
					type: "reference",
					ready: true,
					userId: ownerId,
				})
				.returning({ id: uploads.id }),
		).id;

		await expect(
			createSample(db, values({ files: [reference] })),
		).rejects.toBeInstanceOf(UploadNotFoundError);

		// The reference upload is left untouched by the failed reservation.
		const [row] = await db
			.select({ reserved: uploads.reserved })
			.from(uploads)
			.where(eq(uploads.id, reference));
		expect(row?.reserved).toBe(false);
	});

	it("rejects an unfinished reads upload", async () => {
		const pending = takeFirstOrThrow(
			await db
				.insert(uploads)
				.values({
					createdAt: new Date(),
					name: "reads.fq.gz",
					nameOnDisk: `disk-pending-${Math.random()}`,
					type: "reads",
					ready: false,
					userId: ownerId,
				})
				.returning({ id: uploads.id }),
		).id;

		await expect(
			createSample(db, values({ files: [pending] })),
		).rejects.toBeInstanceOf(UploadNotFoundError);
	});
});

describe("updateSample", () => {
	it("updates scalars and replaces the label set", async () => {
		const first = await seedLabel("first");
		const second = await seedLabel("second");
		const sampleId = await seedSample({ name: "Old" });
		await db
			.insert(legacySampleLabels)
			.values({ sample_id: sampleId, label_id: first });

		const sample = await updateSample(db, sampleId, {
			name: "New",
			labels: [second],
		});

		expect(sample.name).toBe("New");
		expect(sample.labels.map((l) => l.id)).toEqual([second]);
	});

	it("allows renaming a sample to its own name", async () => {
		const sampleId = await seedSample({ name: "Same" });
		const sample = await updateSample(db, sampleId, { name: "Same" });
		expect(sample.name).toBe("Same");
	});

	it("rejects a name already used by another sample", async () => {
		await seedSample({ name: "Taken" });
		const sampleId = await seedSample({ name: "Mine" });
		await expect(
			updateSample(db, sampleId, { name: "Taken" }),
		).rejects.toBeInstanceOf(SampleNameConflictError);
	});

	it("throws when the sample does not exist", async () => {
		await expect(
			updateSample(db, 123456, { name: "x" }),
		).rejects.toBeInstanceOf(SampleNotFoundError);
	});
});

describe("deleteSample", () => {
	it("cascades across the sample's tables and releases its reserved uploads", async () => {
		const uploadId = await seedUpload(true);
		const sampleId = await seedSample({ name: "Doomed" });

		await db.insert(sampleUploads).values({
			sample: String(sampleId),
			sample_id: sampleId,
			upload_id: uploadId,
			index: 0,
		});
		await db.insert(sampleReads).values({
			sample: String(sampleId),
			sample_id: sampleId,
			name: "reads_1.fq.gz",
			name_on_disk: "reads_1.fq.gz",
		});
		await db.insert(sampleArtifacts).values({
			sample: String(sampleId),
			sample_id: sampleId,
			name: "a.json",
			type: "json",
		});
		await db
			.insert(analyses)
			.values({ sample_id: sampleId, workflow: "nuvs", ready: true });

		const deleted = await deleteSample(db, new MemoryStorage(), sampleId);
		expect(deleted.id).toBe(sampleId);

		expect(
			await db
				.select()
				.from(legacySamples)
				.where(eq(legacySamples.id, sampleId)),
		).toHaveLength(0);
		expect(
			await db
				.select()
				.from(sampleUploads)
				.where(eq(sampleUploads.sample_id, sampleId)),
		).toHaveLength(0);
		expect(
			await db
				.select()
				.from(sampleReads)
				.where(eq(sampleReads.sample_id, sampleId)),
		).toHaveLength(0);
		expect(
			await db
				.select()
				.from(sampleArtifacts)
				.where(eq(sampleArtifacts.sample_id, sampleId)),
		).toHaveLength(0);
		expect(
			await db.select().from(analyses).where(eq(analyses.sample_id, sampleId)),
		).toHaveLength(0);

		const [upload] = await db
			.select({ reserved: uploads.reserved })
			.from(uploads)
			.where(eq(uploads.id, uploadId));
		expect(upload?.reserved).toBe(false);
	});

	it("throws when the sample does not exist", async () => {
		await expect(
			deleteSample(db, new MemoryStorage(), 123456),
		).rejects.toBeInstanceOf(SampleNotFoundError);
	});
});

describe("updateSampleRights", () => {
	it("sets the rights flags", async () => {
		const sampleId = await seedSample({ name: "Rights" });
		const sample = await updateSampleRights(db, sampleId, {
			allRead: true,
			groupWrite: true,
		});
		expect(sample.allRead).toBe(true);
		expect(sample.groupWrite).toBe(true);
	});

	it("resolves and assigns a group by id", async () => {
		const groupId = await seedGroup(db, { name: "grp" });
		const sampleId = await seedSample({ name: "Rights" });
		const sample = await updateSampleRights(db, sampleId, { group: groupId });
		expect(sample.group?.id).toBe(groupId);
	});

	it("clears the group when passed null", async () => {
		const groupId = await seedGroup(db, { name: "grp" });
		const sampleId = await seedSample({ name: "Rights", group_id: groupId });
		const sample = await updateSampleRights(db, sampleId, { group: null });
		expect(sample.group).toBeNull();
	});

	it("rejects a group that does not exist", async () => {
		const sampleId = await seedSample({ name: "Rights" });
		await expect(
			updateSampleRights(db, sampleId, { group: 987654 }),
		).rejects.toBeInstanceOf(SampleGroupNotFoundError);
	});

	it("throws when the sample does not exist", async () => {
		await expect(
			updateSampleRights(db, 123456, { allRead: true }),
		).rejects.toBeInstanceOf(SampleNotFoundError);
	});
});

describe("sampleReadableFilter", () => {
	it("returns undefined for an administrator", () => {
		expect(sampleReadableFilter(adminActor)).toBeUndefined();
	});

	it("returns a predicate for a non-administrator", () => {
		const actor: SampleActor = { userId: 1, groupIds: [2], isAdmin: false };
		expect(sampleReadableFilter(actor)).toBeDefined();
	});
});

describe("resolveSampleActor", () => {
	it("resolves group membership and the admin flag", async () => {
		const groupId = await seedGroup(db, { name: "g" });
		const adminId = await seedUser(db, {
			handle: "admin",
			administratorRole: "full",
		});
		await addToGroup(db, adminId, groupId);

		const actor = await resolveSampleActor(db, adminId);
		expect(actor.isAdmin).toBe(true);
		expect(actor.groupIds).toEqual([groupId]);

		const plain = await resolveSampleActor(db, ownerId);
		expect(plain.isAdmin).toBe(false);
	});
});
