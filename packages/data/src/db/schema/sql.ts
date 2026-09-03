// SQL expression helpers shared by the schema mirrors. Not table definitions,
// so this module is deliberately absent from `./index.ts`.

import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * A column folded to lower case, for an index the real schema declares over
 * the expression rather than the column.
 *
 * Drizzle has no built-in for this, and an index whose expression does not
 * match the real one byte for byte describes a different index.
 */
export function lower(column: AnyPgColumn): SQL {
	return sql`lower(${column})`;
}

/**
 * A column trimmed and folded to lower case — the normalized form of an email
 * address, as an index expression.
 *
 * Matches `normalizeEmail` in `src/auth/email.ts`. The two must agree: the
 * index decides which pairs of rows collide, and the function decides which
 * pairs the migration refuses to migrate.
 */
export function lowerTrim(column: AnyPgColumn): SQL {
	return sql`lower(btrim(${column}))`;
}
