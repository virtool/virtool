// Recording a change to an OTU. A port of `virtool.history.db.add` and the
// description composers in `virtool.history.utils`.
//
// Separate from `./data.ts` so the arrow between the two domains runs one way:
// `otus/data.ts` records changes through this module, and `history/data.ts`
// reads OTUs through `otus/data.ts`. Folding this back in would close that into
// a cycle.

import type { HistoryMethod } from "@virtool/contracts";
import type { DbOrTx } from "../db/pg";
import { takeFirstOrThrow } from "../db/rows";
import { legacyHistory, legacyHistoryDiff } from "../db/schema/history";
import type { OtuDocument } from "../otus/data";
import { diff } from "./dictdiffer";

/** What a `NULL` `otu_version` stands for: the change removed the OTU. */
const REMOVED = "removed";

/** The change to record, as the OTU stood on either side of it. */
export type HistoryValues = {
	/** A human-readable description of the change */
	description: string;

	/** The kind of change */
	methodName: HistoryMethod;

	/** The joined OTU before the change, or `null` when it created the OTU */
	old: OtuDocument | null;

	/** The joined OTU after the change, or `null` when it removed the OTU */
	new: OtuDocument | null;

	/** The primary key of the OTU's parent reference */
	referenceId: number;

	/** The user who made the change */
	userId: number;
};

/**
 * The description of a change, as its past-tense method name applied to the OTU.
 *
 * Python appends the `d` and, unless the method already ends in one, the `e`
 * before it — `clone` becomes `Cloned` and `import` becomes `Imported`. Only the
 * methods the bulk paths record are described this way; every other method has
 * its own composer, because the generic phrasing reads badly for them.
 */
export function composeHistoryDescription(
	methodName: HistoryMethod,
	name: string,
	abbreviation: unknown,
): string {
	const suffix = methodName.endsWith("e") ? "d" : "ed";
	const description = `${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}${suffix} ${name}`;

	if (typeof abbreviation === "string" && abbreviation) {
		return `${description} (${abbreviation})`;
	}

	return description;
}

/** The description of a change that created an OTU. */
export function composeCreateDescription(document: OtuDocument): string {
	return composeHistoryDescription(
		"create",
		String(document.name),
		document.abbreviation,
	);
}

/** The description of a change that removed an OTU. */
export function composeRemoveDescription(document: OtuDocument): string {
	return composeHistoryDescription(
		"remove",
		String(document.name),
		document.abbreviation,
	);
}

/**
 * The description of a change that edited an OTU's name, abbreviation, or
 * schema.
 *
 * Only what changed is described: pass `null` for a field the edit left alone,
 * and `schemaChanged` false when the schema is untouched. Python instead
 * composes from the post-change document, so every one of its edit entries
 * names all three fields whether or not they moved — entries written before
 * this read that way and are left as they are, because a stored description is
 * a record of what was said at the time.
 */
export function composeEditDescription(
	name: string | null,
	abbreviation: string | null,
	oldAbbreviation: string,
	schemaChanged: boolean,
): string {
	let description = name ? `Changed name to ${name}` : "";

	if (abbreviation !== null) {
		let phrase: string;

		if (abbreviation === "" && oldAbbreviation) {
			phrase = `removed abbreviation ${oldAbbreviation}`;
		} else if (abbreviation && !oldAbbreviation) {
			phrase = `added abbreviation ${abbreviation}`;
		} else {
			phrase = `changed abbreviation to ${abbreviation}`;
		}

		description = description
			? `${description} and ${phrase}`
			: `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}`;
	}

	if (schemaChanged) {
		description = description
			? `${description} and modified schema`
			: "Modified schema";
	}

	return description;
}

// The OTU a change was made to, taken from whichever side of the change still
// has a document. A remove has no `new`, and so no numbered version — that is
// what the `"removed"` sentinel stands in for.
function deriveOtuInformation(
	old: OtuDocument | null,
	updated: OtuDocument | null,
): { otuId: string; otuName: string; otuVersion: number | typeof REMOVED } {
	const source = old ?? updated;

	if (source === null) {
		throw new Error("A change must carry the OTU on at least one side");
	}

	const version = updated?.version;

	return {
		otuId: String(source._id),
		otuName: String(source.name),
		otuVersion: typeof version === "number" ? version : REMOVED,
	};
}

/**
 * The diff a change stores.
 *
 * A create stores the whole new document and a remove the whole old one; there
 * is no other side to diff against. Everything else stores a dictdiffer diff —
 * including the `clone` and `import` a bulk insertion records, whose `old` is
 * `null` and whose diff is therefore built against nothing.
 */
export function composeDiff(values: HistoryValues): unknown {
	if (values.methodName === "create") {
		return values.new;
	}

	if (values.methodName === "remove") {
		return values.old;
	}

	return diff(values.old, values.new);
}

/**
 * Record a change to an OTU, writing its `legacy_history` row and the
 * `legacy_history_diff` row holding the diff.
 *
 * Both inserts run on the caller's transaction and neither commits — a change
 * lands with the OTU write it describes or not at all.
 *
 * The reference is passed in rather than read from the OTU document's embedded
 * `reference.id`. Python resolves that field through `resolve_legacy_id` because
 * a historical document may carry a stale Mongo string; the promoted
 * `legacy_otus.reference_id` column is the integer key with no such ambiguity,
 * and every caller already holds it.
 */
export async function addHistory(
	tx: DbOrTx,
	values: HistoryValues,
): Promise<void> {
	const { otuId, otuName, otuVersion } = deriveOtuInformation(
		values.old,
		values.new,
	);

	const changeId = `${otuId}.${otuVersion}`;

	const rows = await tx
		.insert(legacyHistory)
		.values({
			legacy_id: changeId,
			created_at: new Date(),
			description: values.description,
			method_name: values.methodName,
			user_id: values.userId,
			otu: otuId,
			otu_name: otuName,
			// The sentinel is never stored. A `NULL` here is what marks the change
			// that removed the OTU, and every read reverses the convention.
			otu_version: otuVersion === REMOVED ? null : String(otuVersion),
			reference_id: values.referenceId,
		})
		.returning({ id: legacyHistory.id });

	await tx.insert(legacyHistoryDiff).values({
		change_id: changeId,
		history_id: takeFirstOrThrow(rows).id,
		diff: composeDiff(values),
	});
}
