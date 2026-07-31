import { z } from "zod";

/**
 * Any value that survives a JSON round trip.
 *
 * Used for payloads this side treats as opaque — a workflow's `results` blob, a
 * BLAST response — where the shape belongs to whoever wrote it. `unknown` would
 * be the honest type for "we do not interpret this", but a server function's
 * return value is checked for serializability, and `unknown` fails that check
 * because it admits values that cannot cross the wire. This says the same thing
 * while staying provably serializable.
 */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/** A JSON object whose keys carry values we do not interpret. */
export type JsonObject = { [key: string]: JsonValue };

/**
 * Validates {@link JsonValue}.
 *
 * The schema is recursive, so it is built with `z.lazy` and annotated with the
 * type it produces — zod cannot infer a self-referential shape on its own.
 */
export const JsonValue: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(JsonValue),
		z.record(z.string(), JsonValue),
	]),
);

/** Validates {@link JsonObject}. Parses an opaque blob without interpreting it. */
export const JsonObject: z.ZodType<JsonObject> = z.record(
	z.string(),
	JsonValue,
);
