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

## This side owns schema and migrations

Schema changes are made here. `packages/data/src/db/schema/` is the
definition, `pnpm --filter @virtool/data db:generate` writes the
migration into `packages/data/drizzle/`, and `apps/tasks`' second
entrypoint (`node dist/migrate.mjs`, `apps/tasks/src/migrate.ts`)
applies it — in the dev cluster as a Job, and in production as the same
image. Migration `0000_baseline` was generated from this schema,
hand-checked against a `pg_dump --schema-only` of production, and
stamped as already-applied rather than run; every migration after it
runs for real.

Making a schema change:

1. Edit the table in `packages/data/src/db/schema/`.
2. Run `db:generate` and **read the SQL it emits**. It is generated from
   a diff, not from intent, and the ordering of statements within one
   migration is its own guess.
3. Apply both to a scratch database — the baseline, then the new
   migration, against seeded rows — before committing. A migration is
   applied inside a transaction, so anything that cannot run in one
   (`ALTER TYPE ... ADD VALUE`, `CREATE INDEX CONCURRENTLY`) has to be
   reworked rather than merged.
4. Commit the `.sql`, its `meta/*_snapshot.json` and the updated
   `meta/_journal.json` together. The snapshot is what the next
   `db:generate` diffs against; without it the following migration is
   generated against the wrong starting shape.

**Python is still deployed against the same database**, so a schema
change has to leave it working. Dropping or narrowing something Python
still reads breaks the deployed app; adding, and widening, do not.

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
for a column that genuinely carries a `server_default` — no existing one
does, and adding one to a column Python also inserts into would put two
opinions about the default in play.

### Foreign keys: declare them table-level, with an explicit name

Every foreign key uses the table-level `foreignKey({ columns,
foreignColumns, name })`, never an inline `.references()`. The name is
always `{table}_{column}_fkey`, which is the default name Postgres
assigned because Alembic never named these constraints itself.

Inline `.references()` agrees with production on the columns, the
referenced table and the referential actions — and disagrees on the
name, auto-generating `{table}_{column}_{reftable}_{refcolumn}_fk`.
Nothing catches that at apply time. Migration `0000` is stamped as
already-applied rather than run, so a wrong name never reaches a
database; it reaches `meta/0000_snapshot.json`, which every later
`drizzle-kit generate` diffs against. The first migration to touch a
foreign key would then emit SQL naming a constraint production does not
have, and fail long after anything connects it to the cause.

`schema/foreignKeys.test.ts` pins all 54 against that rule, so a new
table declared with `.references()` fails the suite by name.

### Column constraints: mirror them, and only them

The mirror's one job is fidelity, so a column's TypeScript type has to
say exactly what the database enforces — no more and no less.

**Closed by a CHECK constraint → `.$type<Union>()`.** Every enumeration
in the schema is a `text` column plus a CHECK constraint, so a value
outside the union cannot reach the column without a migration. `$type` is
an *assertion*, not validation, which is precisely what the constraint
makes safe. Name the constraint in a comment so the
next reader can check the claim:

```ts
// `text`, closed by the `ck_jobs_state` CHECK constraint. `$type` asserts
// rather than validates, which is what that constraint makes safe.
state: text("state").$type<JobState>().notNull(),
```

The constrained columns today are `jobs.state` (`ck_jobs_state`),
`uploads.type` (`ck_uploads_type`), `instance_messages.color`
(`ck_instance_messages_color`), `index_files.type`
(`ck_index_files_type`), `analysis_files.format`
(`ck_analysis_files_format`), `subtraction_files.type`
(`ck_subtraction_files_type`), `settings.sample_group`
(`ck_settings_sample_group`), `sessions.session_type`
(`session_type_valid`) and `users.administrator_role`
(`administrator_role_valid`). The last two are the holdouts from the
`ck_{table}_{column}` naming convention, not an alternative to it.

**Unconstrained → `string`.** `jobs.workflow` has no CHECK constraint;
Python's `Workflow` is an application-level enum only. So a row can name
a workflow this build has never heard of, and narrowing the column would
be a lie that reads clean and then hands a runner a `JobsApiError` it can
do nothing about. That openness is load-bearing: it is why the jobs API's
metrics registry folds an unrecognised workflow into `other`, and why
`isJobStateTerminal` takes a plain `string`.

**The union lives in `@virtool/contracts`.** The mirror imports it; it
does not declare its own copy. `packages/data` previously carried a
second `JOB_STATES`/`JobState` beside the contracts one — two definitions
of the same five strings, free to disagree.

**No live column is a native Postgres enum.** `analysis_files.format`
and `subtraction_files.type` were the last two, backed by the
`analysisformat` and `subtractiontype` types; `0001_enum_check_constraints`
altered both columns to `text`, added their CHECKs and dropped the types.
The reason is the migration mechanism rather than the modelling: adding a
member to an enum takes `ALTER TYPE ... ADD VALUE`, which Postgres refuses
inside a transaction block, so a migration carrying one cannot roll back
with the rest of its batch; removing or renaming one takes a full type
swap. A CHECK is one `DROP CONSTRAINT` / `ADD CONSTRAINT` pair, and it is
transactional.

Two `pgEnum` declarations survive, `action` and `resourcetype` in
`vestigial.ts`. They are reachable only from `permissions`, a table
nothing reads, and are dropped along with it rather than converted —
there is no point spending a type swap on a column that is going away.

## What the TS server can reach today

**Built** — a Drizzle mirror in `packages/data/src/db/schema/` plus a
  `packages/data/src/<feature>/data.ts` and an
  `apps/web/src/server/<feature>/functions.ts`. The domain is served from
  this repo; ready to use.

Caches are the one **Built** domain with no `functions.ts` in
`apps/web`. Nothing in the SPA reads a cache — only workflows do.

A `legacy_` table prefix marks a table that carries the Mongo-era row
shape and a `legacy_id` column from the import — it is a normal Postgres
table, not a Mongo remnant. Expect legacy-id resolution (see below) when
joining across those tables.

## Building a feature against a Postgres domain

With every domain in Postgres and every production table already
declared in `packages/data/src/db/schema/`, building a TS server feature
for a domain this side does not serve yet is ordinary Drizzle work: write
the feature's `data.ts` beside the schema and its `functions.ts` in
`apps/web/src/server/`. Two things carry over from the migration:

- **Legacy-shaped tables.** Domains imported from Mongo (`legacy_otus`,
  `legacy_references`, `legacy_samples`, `legacy_sequences`,
  `legacy_history`, …) keep the Mongo-era shape and a `legacy_id`
  column. Joins across them may need legacy-id resolution (below),
  because the backfills that replace legacy string handles with integer
  ids are not complete.

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

### Advisory locks, and the two-part index build

Starting an index build is the one write that takes a Postgres advisory
lock, and the reason is that a build is two writes with a task between
them — either service can be running either half.

`createIndex` (`@virtool/data/indexes/data`) inserts the pending `indexes` row,
stamps every `legacy_history` row whose `index_id` is `NULL` with the new
build, and creates a `create_index` task. Whichever runner claims that
task finishes the build: `generateTaskIndex`, in the same module, patches
every OTU in the manifest back to the version the build was pinned to,
writes both artifacts into freshly minted keys, records an `index_files`
row for each **with its own key on it**, promotes
`legacy_otus.last_indexed_version`, and only then sets `ready = true`.

A build publishes two files describing the same OTUs:
`reference-snapshot.v1.sqlite.gz`, which every analysis stream-decompresses to
a local raw SQLite file before reading, and
`reference-v2.json.gz` beside it. Both rows are written in the
transaction that flips `ready`, because an index that reports itself
ready without a snapshot cannot be analysed at all — a workflow claimed
against one fails before its first step, and nothing short of another
build fixes it.

Two builds of one reference would each stamp the other's changes and then
collide on the `(reference_id, version)` unique constraint, so the insert
runs inside a transaction that first takes

```sql
select pg_try_advisory_xact_lock(hashtext('index_build:' || :referenceId))
```

The `try` variant does not block — a caller that loses the race is told a
build is already in progress rather than waiting on one. The lock is
transaction-scoped (`_xact_`), so it releases on commit or rollback with
no unlock call to forget. The key is `hashtext` of that literal string
with the **integer** reference id, byte-for-byte what Python composes, so
a build started from either service excludes one started from the other.
A divergent key would silently stop excluding anything.

The in-progress check runs twice on purpose: once before the lock, as a
cheap rejection that avoids reading the manifest, and once inside it,
which is the one that is actually race-free. Both raise the same error,
so a caller cannot tell which fired.

Two columns matter for the handoff:

- **`manifest`** is `{otuId: otuVersion}` captured at the moment the
  build starts. It is what pins the artifact to a point in time, so it is
  read before the lock is taken rather than inside the transaction.
- **`indexes.storage_key`** is dead. Keys were once composed as
  `indexes/{storage_key}/{file name}`; each `index_files` row now records
  its own complete key instead. The column is still `NOT NULL`, so the
  insert has to fill it — it stays until a cleanup migration, so a
  rolling deploy never has readers of a dropped column — but nothing
  reads it. `indexes.otus_json_storage_key` is the one key still held on
  the index itself: the compressed OTU JSON is materialized on demand and
  deliberately has no `index_files` row, because one would publish it in
  the index's file listing.

`indexes` carries a `num_nonnulls(job_id, task_id) <= 1` check upstream:
a build is backed by at most one of a legacy workflow job or a task. A
build started from here always sets `task_id` and leaves `job_id` null.

## Migration tooling

- **The baseline is stamped, not run.** `0000_baseline` describes
  production as it already was. Its foreign key names were the one point
  of drift from what Drizzle generates by default, on all 54 of them —
  see "Foreign keys" above; index naming, default expressions and enum
  value ordering all matched.
- **`casing: 'snake_case'`** in `drizzle.config.ts`. It is set, but it
  decides nothing today: every column in the mirror passes its name
  explicitly, so there is nothing for the flag to infer. It is a
  guardrail for a column added without one, not a fix for an existing
  problem.
- **Pair `drizzle-orm` and `drizzle-kit` versions.** They share
  internals and ship breaking changes together. Bumping one without
  the other has shipped silent schema-generation regressions in the
  past. Check the release notes before either bump.
