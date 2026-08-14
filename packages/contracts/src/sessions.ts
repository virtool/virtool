import { z } from "zod";

/**
 * The kind of session a `sessions` row records.
 *
 * `sessions.session_type` is a `text` column closed by the
 * `session_type_valid` CHECK constraint; this is the one declaration of what
 * that constraint admits, imported by the schema mirror rather than restated
 * there.
 */
export const SessionType = z.enum(["anonymous", "authenticated", "reset"]);

export type SessionType = z.infer<typeof SessionType>;
