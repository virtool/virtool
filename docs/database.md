# Database

The TypeScript server is **Postgres-first**: it reads and writes
Postgres only, via Drizzle. Postgres is now Virtool's sole data store —
Python removed MongoDB entirely, so every domain's records live in
Postgres and there is no Mongoose / Mongo-driver layer in this repo. A
domain not yet reachable from the TS server is missing only its Drizzle
mirror and server functions, not its data.

This document is the map: who owns schema changes, which domains the TS
server can already reach, and the Postgres conventions a TS server
feature has to respect.

## Python owns schema and migrations

The Python repo (`../virtool`) is the only process that applies schema
changes — Alembic migrations against Postgres. TS server features under
`apps/web/src/server/<feature>/` read and write through Drizzle against
the Postgres schema Python defines; they don't ship their own
migrations.

When a migrating endpoint needs a schema change:

1. Land the schema change in Python's Alembic tree first. Deploy it.
2. Update the Drizzle schema in `apps/web/src/server/db/schema/` to
   match.
3. Then migrate the endpoint.

This ordering is non-negotiable as long as Python is in production —
TS code lagging the schema is fine, but Python lagging the schema
breaks the deployed app.

### Column defaults: use `.$defaultFn()`, never `.default()`

SQLAlchemy's `mapped_column(default=...)` is a **Python-side** default
applied by the ORM at insert time — it does *not* emit a `server_default`,
so the real Postgres columns have **no** server-side `DEFAULT` (there are
zero `server_default`s in the Python repo). Drizzle's `.default(value)`
assumes the opposite: on insert it emits the SQL `DEFAULT` keyword and
relies on the database to fill the column. Against these tables that
yields `null` — a not-null violation on required columns, or a silent
`null` on nullable ones.

Mirror a Python-side default with `.$defaultFn(() => value)`, which
injects the value client-side at insert time (the true analog of
SQLAlchemy's `default=`) and stays out of the DDL. Reserve `.default()`
for a column that genuinely has a `server_default` in Python.

## What the TS server can reach today

Every domain's records live in Postgres; MongoDB is gone. So what gates
a TS server feature is no longer "has this migrated to Postgres" — it's
how much of it this repo has mirrored into Drizzle and wired up. Three
states:

- **Built** — a Drizzle mirror in `apps/web/src/server/db/schema/` plus
  a `data.ts` / `functions.ts` in `apps/web/src/server/<feature>/`. The
  domain is served from this repo; ready to use.
- **Partial mirror** — a read-only Drizzle mirror of only the few
  columns the **jobs** feature needs to reconstruct a job's `args`. The
  domain itself is not served yet; building it out means mirroring the
  rest of its tables and columns first.
- **Not started** — Postgres owns the data, but this repo has no Drizzle
  mirror at all. Write the mirror first (against the tables Python
  defines), then the feature.

| Domain       | Postgres table(s)                                    | TS status      |
| ------------ | ---------------------------------------------------- | -------------- |
| Users        | `users`, `user_groups`                               | Built          |
| Groups       | `groups`                                             | Built          |
| Sessions     | `sessions`                                           | Built          |
| Messages     | `instance_messages`                                  | Built          |
| Tasks        | `tasks`                                              | Built          |
| Labels       | `labels`                                             | Built          |
| Jobs         | `jobs`                                               | Built          |
| Settings     | `settings`                                           | Built          |
| HMMs         | `hmms`, `legacy_hmm_status`                          | Built          |
| API keys     | `api_keys`                                           | Built          |
| Analyses     | `analyses`                                           | Partial mirror |
| Indexes      | `indexes`                                            | Partial mirror |
| Samples      | `legacy_samples`, `legacy_sample_*`, `sample_*`      | Built          |
| Subtractions | `subtractions`, `subtraction_files`                  | Built          |
| References   | `legacy_references`, `legacy_reference_*`            | Built          |
| Uploads      | `uploads`                                            | Not started    |
| OTUs         | `legacy_otus`                                        | Partial mirror |
| Sequences    | `legacy_sequences`                                   | Not started    |
| History      | `legacy_history`, `legacy_history_diff`, `revisions` | Partial mirror |

The Postgres table(s) column lists the single mirrored table for the
**partial mirror** rows and the principal Python-defined table(s) for
the rest; it is not the domain's full table set. The **partial mirror**
rows exist to feed other served domains, not themselves. `jobs` has no
`args` column, so a job's resources are recomposed at read time from
reverse `job_id` foreign keys on `analyses`, `indexes`, and
`legacy_samples` (there are no `job_*` junction tables). The references
read path adds three more: `legacy_otus` (an OTU count and the clone
manifest), `legacy_history` (contributors and the unbuilt-change count),
and the extra `indexes` columns that resolve a reference's latest build.
The samples read path adds three columns to the `analyses` mirror —
`sample_id`, `workflow`, and `ready` — to derive a sample's workflow tags
(a `GROUP BY workflow, bool_or(ready)`) and to power the `workflows=`
filter (a correlated `EXISTS`); the analyses domain itself is still only a
partial mirror. Each partial mirror declares just the columns its consumer
needs. The `subtractions` mirror is now full — the subtraction domain is
served from this repo — but jobs still reaches it through the same reverse
`job_id` foreign key.

A `legacy_` table prefix marks a table that carries the Mongo-era row
shape and a `legacy_id` column from the import — it is a normal Postgres
table, not a Mongo remnant. Expect legacy-id resolution (see below) when
joining across those tables.

## Building a feature against a Postgres domain

With every domain in Postgres, building a TS server feature for a
partial-mirror or not-started domain is ordinary Drizzle work: mirror
the tables (and, for a partial mirror, the remaining columns) Python
defines into `apps/web/src/server/db/schema/`, then write the feature's
`data.ts` / `functions.ts`. Two things carry over from the migration:

- **Legacy-shaped tables.** Domains imported from Mongo (`legacy_otus`,
  `legacy_references`, `legacy_samples`, `legacy_sequences`,
  `legacy_history`, …) keep the Mongo-era shape and a `legacy_id`
  column. Joins across them may need legacy-id resolution (below),
  because the backfills that replace legacy string handles with integer
  ids are not complete.
- **Aggregation lives in Python today.** The Python list endpoints for
  samples, analyses, OTUs, and references build their responses with SQL
  aggregation on the server. A TS port re-expresses that in Drizzle
  against the same tables — there is no Mongo pipeline to translate any
  more, but there is real query logic to reproduce.

## Transactions and the `DbOrTx` handle

A sequence of writes where a partial result is a bug — a password change
that must not land unless the session that goes with it lands too —
belongs in a single `db.transaction(...)`. Return whatever the caller
needs out of the callback and act on it *after* the commit; a side effect
performed inside the callback (setting a cookie, emitting an event) still
happens when the transaction later rolls back.

Do the slow, non-database work before opening the transaction. `updateUser`
and `resetPassword` both hash the new password first: bcrypt at cost 12
costs hundreds of milliseconds, and an open transaction should not sit idle
waiting for it.

`db.transaction` hands the callback a Drizzle transaction handle, which is
**not** assignable to `Db` (`Db` is the pooled `PostgresJsDatabase` and
carries a `$client` the transaction lacks). Passing one to a function typed
`Db` fails to compile with `TS2345`. So a helper that needs to work both
standalone and inside a transaction takes `DbOrTx`:

```ts
import type { DbOrTx } from "../db/pg";

export async function invalidateUserSessions(
    db: DbOrTx,
    userId: number,
): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
}
```

`DbOrTx` covers the shared query-builder surface, which is everything a
`data.ts` function normally touches. Reach for `Db` only when the function
genuinely needs something a transaction cannot give it.

### Stubbed-out cross-domain reads

A feature occasionally exposes a field that depends on a domain whose TS
layer hasn't been built yet — e.g. a label's sample count, which needs a
join against the sample tables. Stub these to a neutral value (`0`,
empty) until you wire the join up, keeping the field in the response
shape so the client contract is stable. `labels/data.ts` does this:
every label reports `count: 0` because the sample-label join isn't wired
into the TS server yet — the data is in Postgres (`legacy_sample_labels`),
it just isn't read here.

## Legacy id resolution

User and group rows in Postgres carry a `legacy_id text` column that
holds the original Mongo `_id` string. Other Postgres tables that
reference a user or group may still store that reference as the legacy
string handle in some rows and the new int id in others — backfills
are not complete.

Concretely, a referencing row's `user_id` (or group reference) may be:

- a Postgres `users.id` integer (post-backfill writes), or
- a legacy Mongo handle string (pre-backfill writes).

Any query resolving such a reference must accept both forms. The
Python code does this with helpers in `virtool/data/topg.py`:

- `resolve_user_id(mongo_handle)` — look up the PG int id from a
  legacy string handle.
- `get_user_id_single_variants(id)` — given either form, return both
  forms for matching.
- `get_user_id_multi_variants(ids)` — same, for bulk queries.
- `compose_legacy_id_single_expression` /
  `compose_legacy_id_multi_expression` — build the equivalent SQL
  side.

TS port plan: when a server feature first needs legacy-id resolution,
port these into `apps/web/src/server/db/legacy_id.ts` (or similar) and
use them everywhere a `legacy_id` column is touched. Don't reinvent
per-feature.

These helpers stay relevant until the backfills are complete and the
`legacy_id` columns are dropped — likely a long time.

## If we ever own Postgres migrations from TS

Today Python owns the Postgres schema via Alembic and the TS side
mirrors it by hand (`apps/web/src/server/db/schema/`). Eventually,
once enough domains have migrated, the TS side will take over schema
ownership. Notes for that day:

- **Baseline against production.** The first `drizzle-kit generate`
  against an empty database will not be byte-identical to what Alembic
  produced. Index naming, default expressions, and enum value
  ordering all drift. Capture the live shape with `pg_dump
  --schema-only`, hand-check the generated migration against it, and
  stamp the live DB as already-applied rather than running the
  generated migration cold.
- **`casing: 'snake_case'`** in `drizzle.config.ts`. Our schema files
  use snake_case columns with camelCase TS identifiers; without this
  flag the generated migrations will rename every column.
- **Pair `drizzle-orm` and `drizzle-kit` versions.** They share
  internals and ship breaking changes together. Bumping one without
  the other has shipped silent schema-generation regressions in the
  past. Check the release notes before either bump.
