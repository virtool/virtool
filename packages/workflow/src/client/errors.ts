import { WorkflowError } from "../errors";

/** Everything {@link JobsApiError} needs to say where it came from. */
export type JobsApiErrorOptions = {
	method: string;
	path: string;
	status?: number;
	cause?: unknown;
};

/**
 * Base for every failure reaching the jobs API.
 *
 * Thrown directly when a non-2xx status has no named subclass. Python raises a
 * bare `ValueError` there (`api/utils.py:140`), which is indistinguishable from
 * a programming error; a named error carrying the status is the improvement.
 */
export class JobsApiError extends WorkflowError {
	readonly status: number | undefined;
	readonly method: string;
	readonly path: string;

	constructor(message: string, options: JobsApiErrorOptions) {
		super(message, { cause: options.cause });

		this.status = options.status;
		this.method = options.method;
		this.path = options.path;
	}
}

/**
 * The request never produced a response — a connection failure, a socket
 * timeout, or the per-request budget expiring.
 *
 * This is the **only** retryable failure. A status-mapped error is a decision
 * the jobs API made and repeating it five times over 25 s is a bug, which
 * is why the two are different classes rather than one carrying a flag.
 */
export class TransportError extends JobsApiError {}

/** 400. */
export class BadRequestError extends JobsApiError {}

/**
 * 401.
 *
 * The jobs API's request guard answers an unauthenticated caller with an opaque
 * 401, so this is the shape a wrong or revoked job key takes.
 */
export class UnauthorizedError extends JobsApiError {}

/** 403. */
export class ForbiddenError extends JobsApiError {}

/** 404. */
export class NotFoundError extends JobsApiError {}

/** 409. */
export class ConflictError extends JobsApiError {}

/** 500. */
export class ServerError extends JobsApiError {}

type JobsApiErrorConstructor = new (
	message: string,
	options: JobsApiErrorOptions,
) => JobsApiError;

const BY_STATUS: ReadonlyMap<number, JobsApiErrorConstructor> = new Map([
	[400, BadRequestError],
	[401, UnauthorizedError],
	[403, ForbiddenError],
	[404, NotFoundError],
	[409, ConflictError],
	[500, ServerError],
]);

const UNDECODABLE = "could not decode response message";

/**
 * The part of a response these helpers touch.
 *
 * Structural rather than `Response`, because the global one comes from
 * `@types/node`'s bundled `undici-types` while the client's comes from the
 * `undici` package itself. Naming the two members actually read keeps the two
 * spellings from having to agree.
 */
export type ErrorResponse = {
	ok: boolean;
	status: number;
	text: () => Promise<string>;
};

/**
 * Pull a human-readable message out of an error response.
 *
 * Mirrors `api/utils.py:124-142`: the JSON body's `message` key when there is
 * one, else the stringified JSON, else the response text, else a fixed
 * fallback.
 */
export async function readErrorMessage(
	response: ErrorResponse,
): Promise<string> {
	let text: string;

	try {
		text = await response.text();
	} catch {
		return UNDECODABLE;
	}

	if (text.trim() === "") {
		return UNDECODABLE;
	}

	try {
		const parsed: unknown = JSON.parse(text);

		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"message" in parsed &&
			typeof parsed.message === "string"
		) {
			return parsed.message;
		}

		return JSON.stringify(parsed);
	} catch {
		return text;
	}
}

/**
 * Throw the error a non-2xx response maps to, consuming the body to build its
 * message.
 *
 * A 2xx response returns without reading the body, which the caller still owns.
 *
 * @throws {JobsApiError} for any non-2xx status.
 */
export async function assertOkResponse(
	response: ErrorResponse,
	options: { method: string; path: string },
): Promise<void> {
	if (response.ok) {
		return;
	}

	const message = await readErrorMessage(response);

	const Named = BY_STATUS.get(response.status);

	const errorOptions = { ...options, status: response.status };

	if (Named) {
		throw new Named(message, errorOptions);
	}

	throw new JobsApiError(
		`unhandled status ${response.status}: ${message}`,
		errorOptions,
	);
}
