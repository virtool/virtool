import type { Db } from "@virtool/data/db/pg";

/**
 * What a metadata read needs to serve a request.
 *
 * A database handle and nothing else. The reads hand a workflow records, never
 * bytes — it holds its own object-storage credentials and fetches every file
 * itself using the recorded key each response carries — so a read that could
 * reach `storage` would be a read that could write one.
 */
export type ReadHandlerDeps = { db: Db };

/**
 * The shape every deliberate 4xx in this service answers with.
 *
 * Returned, never thrown — the same reason `requireJobRequest` returns its
 * refusal. A thrown one would have to be caught where a genuine bug is caught
 * too, and Sentry would then see a routine rejection as an incident.
 */
export function jsonError(status: number, message: string): Response {
	return Response.json({ message }, { status });
}

/**
 * What a schema has to offer for {@link parseJsonBody} to parse a body with it.
 *
 * Structural rather than `z.ZodType` so this app needs no `zod` dependency of
 * its own. tsdown externalises everything in `dependencies`, so declaring one
 * would leave a runtime `import` of zod in a bundle that inlines it today
 * along with `@virtool/contracts`, for a type that is erased anyway.
 */
export type BodySchema<T> = {
	safeParse: (
		data: unknown,
	) =>
		| { success: true; data: T }
		| { success: false; error: { issues: readonly unknown[] } };
};

/**
 * Read a request body as JSON and parse it, returning the value or the
 * `Response` to refuse the request with.
 *
 * Returned, never thrown, matching the `requireJobRequest` idiom: the caller
 * tests the result with `instanceof Response` and returns it as it stands.
 *
 * The two refusals are different on purpose. A body that is not JSON at all
 * carries no parse to report on and is refused with `Malformed body`; one that
 * is JSON of the wrong shape carries `errors`, the schema's own issue list, so
 * a runner can see which field it got wrong. That is the one refusal in this
 * service that says more than `{ message }`.
 */
export async function parseJsonBody<T>(
	request: Request,
	schema: BodySchema<T>,
): Promise<T | Response> {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return jsonError(400, "Malformed body");
	}

	const parsed = schema.safeParse(body);

	if (!parsed.success) {
		return Response.json(
			{ message: "Invalid body", errors: parsed.error.issues },
			{ status: 400 },
		);
	}

	return parsed.data;
}

/**
 * Parse a path parameter that names a row by its integer primary key.
 *
 * Returns `null` for anything that is not a positive integer, including the
 * `"1e3"` and `"1.5"` forms `Number.parseInt` would otherwise round into an id.
 */
function parseRowId(value: string | undefined): number | null {
	if (value === undefined || !/^[1-9]\d*$/.test(value)) {
		return null;
	}

	const id = Number(value);

	return Number.isSafeInteger(id) ? id : null;
}

/**
 * Resolve a path parameter that names a row, or the `Response` to refuse the
 * request with — the `requireJobRequest` idiom again, tested with `instanceof
 * Response`.
 *
 * `notFound` is the same message the resource answers a row that does not exist
 * with, because the two are one outcome to a caller: an id that cannot name a
 * row and an id that names none both mean there is nothing there, and saying
 * which would tell an unauthorised caller what the id space looks like.
 */
export function requireRowId(
	value: string | undefined,
	notFound: string,
): number | Response {
	const id = parseRowId(value);

	return id === null ? jsonError(404, notFound) : id;
}
