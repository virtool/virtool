/**
 * The sequence all three finalize routes run, and the only place it is written.
 *
 * `PATCH /subtractions/{id}`, `PATCH /samples/{id}` and `PATCH /analyses/{id}`
 * are the single call that ends a workflow, and they agree on every step before
 * the write: authenticate the job, resolve the id, parse the body, check the
 * manifest against the resource's own prefix, and measure every object it names
 * before a row exists. They differ in four things — the prefix, the filenames
 * they accept, the rows they write, and the classes the data layer reports an
 * outcome with — so those are what a route hands in.
 */

import type { Db } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { requireJobRequest } from "./auth/guard";
import {
	type BodySchema,
	jsonError,
	parseJsonBody,
	requireRowId,
} from "./http";
import { checkManifest, type ManifestEntry, measureManifest } from "./manifest";

/** What a finalize route needs to serve a request. */
export type FinalizeHandlerDeps = {
	db: Db;
	storage: StorageBackend;
	logger: Logger;
};

/**
 * An outcome the data layer reports by throwing, and the refusal it becomes.
 *
 * The status is not part of it. A finalize route answers the same three —
 * not-found 404, not-owned 403, already-finalized 409 — and a resource that
 * chose its own would be a resource whose ownership check said something
 * different from the other two.
 */
type Refusal = {
	error: new (...args: never[]) => Error;
	message: string;
};

/**
 * What one resource's finalize route knows that {@link finalizeResource} does
 * not.
 *
 * `TRest` is whatever the resource's own fields are — a sample's quality, a
 * subtraction's `count` and `gc`, an analysis's results — and `TEntry` is the
 * manifest entry shape it accepts, which reaches `write` carrying the size
 * storage reported for it.
 */
export type FinalizeResource<TEntry extends ManifestEntry, TRest, TResult> = {
	/** The schema the request body is parsed with. */
	body: BodySchema<TRest & { files: TEntry[] }>;
	/**
	 * The storage prefix every key in the manifest must sit under, which is
	 * `{domain}/{id}/` for the resource this route's own path names.
	 */
	prefix: (id: number) => string;
	/**
	 * The filenames the manifest may carry, or `null` where any plain filename
	 * will do — an analysis names its own outputs.
	 */
	allowedNames: readonly string[] | null;
	/**
	 * The row does not exist: **404**, and the message an id that cannot name a
	 * row is refused with as well.
	 */
	notFound: Refusal;
	/**
	 * The row belongs to another job, or to none: **403**. Checked before its
	 * state, so a row a job does not own never reports whether it is finalized.
	 */
	notOwned: Refusal;
	/** The row is already ready: **409**. */
	alreadyFinalized: Refusal;
	/**
	 * Write the rows and return what the route answers with.
	 *
	 * The domain half of the route: the data function it calls, the columns it
	 * maps each measured entry onto, and the line it logs.
	 */
	write: (context: {
		id: number;
		jobId: number;
		values: TRest & { files: TEntry[] };
		files: (TEntry & { size: number })[];
	}) => Promise<TResult>;
};

/**
 * Serve a finalize route.
 *
 * Everything up to `write` either produces a `Response` to refuse with or falls
 * through, in the order the checks have to run in: nothing reaches storage
 * before the manifest is checked against the resource's prefix, and no row is
 * written before every object it names has been measured — which is what makes
 * a row pointing at nothing impossible.
 *
 * The three refusals `write` can produce are mapped here; anything else it
 * throws is left to `app.onError`, which is where a bug belongs.
 */
export async function finalizeResource<
	TEntry extends ManifestEntry,
	TRest,
	TResult,
>(
	deps: FinalizeHandlerDeps,
	request: Request,
	idParam: string,
	resource: FinalizeResource<TEntry, TRest, TResult>,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const id = requireRowId(idParam, resource.notFound.message);

	if (id instanceof Response) {
		return id;
	}

	const values = await parseJsonBody(request, resource.body);

	if (values instanceof Response) {
		return values;
	}

	const invalid = checkManifest(
		values.files,
		resource.prefix(id),
		resource.allowedNames,
	);

	if (invalid) {
		return jsonError(400, invalid);
	}

	const measured = await measureManifest(deps.storage, values.files);

	if (measured === null) {
		return jsonError(400, "A manifest entry names no stored object");
	}

	try {
		return Response.json(
			await resource.write({
				id,
				jobId: principal.jobId,
				values,
				files: measured,
			}),
		);
	} catch (err) {
		if (err instanceof resource.notFound.error) {
			return jsonError(404, resource.notFound.message);
		}

		if (err instanceof resource.notOwned.error) {
			return jsonError(403, resource.notOwned.message);
		}

		if (err instanceof resource.alreadyFinalized.error) {
			return jsonError(409, resource.alreadyFinalized.message);
		}

		throw err;
	}
}
