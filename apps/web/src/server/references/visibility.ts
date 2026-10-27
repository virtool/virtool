// Visibility guards for everything scoped to a reference. An OTU or an index is
// only as visible as the reference that owns it, so each guard resolves that
// reference and applies the rule `getReferenceFn` does.
//
// A hidden resource and a missing one fail the same way, so a caller cannot use
// the response to learn that a reference they cannot see exists.

import {
	getIndexReferenceId,
	IndexNotFoundError,
} from "@virtool/data/indexes/data";
import { getOtuReference, OtuNotFoundError } from "@virtool/data/otus/data";
import {
	checkReferenceVisibility,
	ReferenceNotFoundError,
	resolveReferenceActor,
} from "@virtool/data/references/data";
import { db } from "../composition";

/** Whether the user may see the reference. `false` when it does not exist. */
export async function isReferenceVisible(
	referenceId: number,
	userId: number,
): Promise<boolean> {
	const actor = await resolveReferenceActor(db, userId);

	return checkReferenceVisibility(db, referenceId, actor);
}

/** Whether the user may see the OTU. `false` when it does not exist. */
export async function isOtuVisible(
	otuId: string,
	userId: number,
): Promise<boolean> {
	const reference = await getOtuReference(db, otuId);

	return reference !== null && isReferenceVisible(reference.id, userId);
}

/** Whether the user may see the index. `false` when it does not exist. */
export async function isIndexVisible(
	indexId: number,
	userId: number,
): Promise<boolean> {
	const referenceId = await getIndexReferenceId(db, indexId);

	return referenceId !== null && isReferenceVisible(referenceId, userId);
}

/** Throw {@link ReferenceNotFoundError} unless the user may see the reference. */
export async function assertReferenceVisible(
	referenceId: number,
	userId: number,
): Promise<void> {
	if (!(await isReferenceVisible(referenceId, userId))) {
		throw new ReferenceNotFoundError();
	}
}

/** Throw {@link OtuNotFoundError} unless the user may see the OTU. */
export async function assertOtuVisible(
	otuId: string,
	userId: number,
): Promise<void> {
	if (!(await isOtuVisible(otuId, userId))) {
		throw new OtuNotFoundError("OTU not found.");
	}
}

/** Throw {@link IndexNotFoundError} unless the user may see the index. */
export async function assertIndexVisible(
	indexId: number,
	userId: number,
): Promise<void> {
	if (!(await isIndexVisible(indexId, userId))) {
		throw new IndexNotFoundError();
	}
}
