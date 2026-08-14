// Read-only mirror of the `caches` table managed by the upstream Python service
// via Alembic. Do not generate or push migrations from this side. Keep the
// columns in sync with `../../../../../../virtool/virtool/caches/pg.py`.

import type { JsonObject } from "@virtool/contracts";
import {
	bigint,
	index,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

export const caches = pgTable(
	"caches",
	{
		id: serial("id").primaryKey(),
		key: text("key").notNull(),
		// A per-write UUID under `caches/v1/`, stored verbatim rather than derived
		// from the row id, so two writers racing on the same `key` never target the
		// same object and the loser can delete its own orphan.
		storage_key: text("storage_key").notNull(),
		params: jsonb("params").$type<JsonObject>().notNull(),
		// Cache payloads routinely exceed 2 GiB, past the range of a 32-bit
		// integer, so this mirrors Python's BigInteger — the same reasoning as
		// `uploads.size`. `mode: "number"` is safe up to 2^53.
		size: bigint("size", { mode: "number" }).notNull(),
		created_at: timestamp("created_at").notNull(),
		last_accessed_at: timestamp("last_accessed_at").notNull(),
	},
	(table) => [
		index("ix_caches_last_accessed_at_id").on(table.last_accessed_at, table.id),
		// Named, not inferred. Python pins `cache_key` in three places so the
		// expected duplicate-key race is distinguishable from any other integrity
		// violation. It also has to exist here for tests to exercise the conflict
		// path at all: `createTestDatabase()` derives its DDL from these mirrors, so
		// an undeclared constraint is simply absent from a test database.
		unique("cache_key").on(table.key),
		unique("caches_storage_key_key").on(table.storage_key),
	],
);

/** A row from the `caches` table. */
export type CacheRow = typeof caches.$inferSelect;
