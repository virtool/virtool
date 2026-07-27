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
