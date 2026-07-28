// The rows that have to exist before an index can be read or built: a reference
// to own the build, OTUs for its manifest, and the history changes a build
// stamps.
//
// Shared by the data and server-function suites so the two cannot drift on what
// a buildable reference looks like — a build refuses on unverified OTUs and on
// having no unbuilt changes, so a seeder that got either wrong would make a test
// pass for the wrong reason.

import type { Db } from "../../db/pg";
import { takeFirstOrThrow } from "../../db/rows";
import { legacyHistory } from "../../db/schema/history";
import { indexes } from "../../db/schema/indexes";
import { legacyOtus } from "../../db/schema/otus";
import {
	legacyReferences,
	legacyReferenceUsers,
} from "../../db/schema/references";

/** The rights a seeded reference member holds. */
export type SeededMemberRights = {
	build?: boolean;
	modify?: boolean;
	modifyOtu?: boolean;
};

/**
 * Insert a reference owned by `userId` and return its id.
 *
 * `member` seeds a membership row granting only the rights it names; omit it
 * entirely for a reference with no members, which is what a data-layer test
 * wants — rights are enforced in `functions.ts`, never in `data.ts`.
 */
export async function seedReference(
	db: Db,
	userId: number,
	{
		archived = false,
		name = "Reference",
		member,
	}: {
		archived?: boolean;
		name?: string;
		member?: SeededMemberRights;
	} = {},
): Promise<number> {
	const referenceId = takeFirstOrThrow(
		await db
			.insert(legacyReferences)
			.values({
				name,
				description: "",
				organism: "virus",
				created_at: new Date(),
				archived,
				restrict_source_types: false,
				source_types: [],
				user_id: userId,
			})
			.returning({ id: legacyReferences.id }),
	).id;

	if (member) {
		await db.insert(legacyReferenceUsers).values({
			reference_id: referenceId,
			user_id: userId,
			build: member.build ?? false,
			modify: member.modify ?? false,
			modify_otu: member.modifyOtu ?? false,
		});
	}

	return referenceId;
}

// `storage_key` is unique, and cannot be derived from the row id, so each seeded
// build mints its own.
let storageKeyCounter = 0;

/** Insert a build, finished unless told otherwise, and return its id. */
export async function seedIndex(
	db: Db,
	values: {
		referenceId: number;
		userId: number;
		version: number;
		ready?: boolean;
		createdAt?: Date;
	},
): Promise<number> {
	storageKeyCounter += 1;

	return takeFirstOrThrow(
		await db
			.insert(indexes)
			.values({
				created_at: values.createdAt ?? new Date(),
				manifest: {},
				ready: values.ready ?? true,
				reference_id: values.referenceId,
				storage_key: `storage-${storageKeyCounter}`,
				user_id: values.userId,
				version: values.version,
			})
			.returning({ id: indexes.id }),
	).id;
}

// OTU ids are the 8-character Mongo id, not a sequence, so a seeder mints them.
let otuCounter = 0;

/** Insert an OTU, verified unless told otherwise, and return its id. */
export async function seedOtu(
	db: Db,
	referenceId: number,
	{ verified = true, name = "OTU", version = 1 } = {},
): Promise<string> {
	otuCounter += 1;
	const id = `otu${otuCounter}`;

	await db.insert(legacyOtus).values({
		id,
		data: {},
		name,
		abbreviation: "",
		reference_id: referenceId,
		verified,
		version,
	});

	return id;
}

let changeCounter = 0;

/**
 * Insert a change against an OTU. It is unbuilt — the state a build stamps —
 * unless `indexId` names the build that already covers it.
 */
export async function seedChange(
	db: Db,
	values: {
		referenceId: number;
		userId: number;
		otuId: string;
		otuName?: string;
		otuVersion?: string | null;
		description?: string;
		methodName?: string;
		indexId?: number;
	},
): Promise<void> {
	changeCounter += 1;

	await db.insert(legacyHistory).values({
		legacy_id: `${values.otuId}.${changeCounter}`,
		created_at: new Date(),
		description: values.description ?? `Change ${changeCounter}`,
		method_name: values.methodName ?? "edit",
		user_id: values.userId,
		otu: values.otuId,
		otu_name: values.otuName ?? "OTU",
		// A `NULL` `otu_version` is the "removed" sentinel, so an explicit null is
		// distinct from the default.
		otu_version: values.otuVersion === undefined ? "1" : values.otuVersion,
		reference_id: values.referenceId,
		index_id: values.indexId ?? null,
	});
}
