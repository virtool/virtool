# Virtool

Viral infection diagnostics using next-generation sequencing. Python 3.13+ async
API server using aiohttp, with a PostgreSQL backend. The public-facing web API
has been removed; the only HTTP services are the internal jobs API and task
runner, consumed by the workflow runtime and the separate TypeScript web UI
server.

## Tooling

### Testing

Tests run in Docker containers with a PostgreSQL service, plus S3 (Garage) and
Azure Blob (Azurite) emulators for storage backend testing.

```bash
# Run specific tests, single worker (use for targeted runs)
mise run test -- tests/account

# Run the full suite in parallel (nproc/2 workers)
mise run test:multi

# Update snapshots
mise run test -- --su

# Build test image
mise run test:build

# Shell into test container
mise run test:shell

# Stop test environment
mise run test:down
```

The Docker test stack is **shared across all git worktrees** — the compose
project name is pinned to `virtool`, so every worktree binds the same container
and the same `/app` mount. To stop concurrent runs from clobbering each other,
`test` and `test:multi` serialize stack access with an OS-level `flock` on
`/tmp/virtool-test.lock`; a waiting run queues behind the active one instead of
recreating the container.

Use `test` (single worker) for targeted runs and `test:multi` for the full
suite. Cross-worktree database-name collisions (`vt_test_{worker_id}`,
`test/{worker_id}/...`) are tracked separately and only bite when runs overlap,
which the lock now prevents.

We use Syrupy-based snapshot testing.

Run targeted tests for the modules you changed. Run the full suite before
committing if changes touch shared code (data layer, fixtures, config).

Write tests for behavior owned by the code being changed. A good test should
protect a current requirement, an explicit contract, a meaningful boundary, or a
regression that the changed code is responsible for preventing.

Avoid tests whose main assertion is that unrelated or hypothetical behavior does
not exist. Absence can be worth testing when it is part of a real contract or
security boundary, but not merely because an endpoint, option, state, or feature
might be added someday.

Avoid re-testing behavior that primarily belongs to another module or layer.
When a change depends on shared infrastructure, authentication, routing,
serialization, or another cross-cutting concern, test only the integration point
that the changed code owns unless the change deliberately alters that shared
contract.

Prefer negative tests that exercise meaningful failure modes: invalid input,
unauthorized or forbidden access, missing resources, conflicts, unsupported
states, or regressions tied directly to the changed behavior.

### Test Conventions

Tests mirror the source tree: `virtool/account/` → `tests/account/`. Files are
named `test_*.py`.

Prefer class-based test organization when a group of tests exercises the same
unit, endpoint, or behavior area. Use the class name to describe the shared
context and individual test names to describe the expected behavior.

Avoid parametrized tests when the parameters introduce flag-based control flow,
conditional assertions, or branching setup inside the test body. In those cases,
write separate explicit tests instead. Parametrization is still appropriate for
simple input/output matrices where each case follows the same execution path and
asserts the same contract.

All shared fixtures live in `tests/fixtures/` (not conftest.py). Key fixtures:

- `spawn_job_client` - test HTTP client for the jobs API (`JobClientSpawner`)
- `spawn_task_runner_client` - test HTTP client for the task runner (`TaskRunnerClientSpawner`)
- `fake` - `DataFaker` for creating test entities (`fake.users.create()`, etc.)
- `pg` / `engine` - session-scoped SQLAlchemy `AsyncEngine`
- `snapshot_recent` - Syrupy snapshot with timestamp normalization

Snapshots are stored in `__snapshots__/*.ambr` directories alongside tests.
Custom serializers in `tests/fixtures/snapshot_date.py` normalize timestamps
and UUIDs.

Use `mocker` (pytest-mock) for mocking — `mocker.patch()` and
`mocker.patch.object()`. Use `RespIs` from `tests/fixtures/response.py` for
HTTP response assertions (e.g., `RespIs.not_found()`). Plain `assert` for
everything else.

Tests are async-first via pytest-asyncio. Use `pytest-xdist` (`-n`) for
parallel runs.

Identifiers in test fixtures (row ids, fake names, etc.) should describe
the role they play. Avoid placeholders like `foo`, `bar`, `baz`, `qux` — they
make snapshots and `expected_ids` sets opaque to readers. Prefer names like
`owned_active`, `user_member_active`, `other_archived` that read directly as
the scenario being exercised.

### Formatting and Linting

```bash
# Format and auto-fix
mise run format

# Check formatting only
mise run format:check
```

Ruff is the only linter/formatter (including import sorting).

Before committing, run `mise run format` and targeted tests for changed modules.
Run the full test suite if changes touch shared code (data layer, fixtures,
config). There is no type checker in this project.

### Dev Server

There is no local dev server. The development environment runs via Tilt in a
separate repo (`virtool/dev`).

### Migrations

Create new Alembic revisions with the alembic CLI:

```bash
uv run alembic revision -m "short summary"
```

This writes a stub at `assets/alembic/versions/<id>_<slug>.py` with the next
revision ID and the current head as `down_revision`. Fill in `upgrade()` and
`downgrade()` afterward. Do not hand-write revision files or invent revision
IDs — let alembic generate them so the chain stays consistent.

## Architecture

### Key Directories

- `virtool/` - Main package
  - `api/` - API middleware and route handlers
  - `data/` - Unified data layer (`layer.py`)
  - `pg/` - PostgreSQL models and utilities (SQLAlchemy 2.0+, asyncpg)
  - `migration/` - Database migrations (Alembic)
  - `config/` - Configuration system
  - `jobs/` - Job queue and processing
  - `workflow/` - Workflow execution engine with pytest plugin
  - `sessions/` - `SQLSession` schema only; sessions are owned by the
    TypeScript server
- `tests/` - Test suite (mirrors `virtool/` structure)
  - `fixtures/` - Shared pytest fixtures

### Entry Points

- `virtool server jobs` - Jobs API server (port 9950)
- `virtool tasks runner` - Task runner

### Data Layer

Request handlers must always go through data layer domains (`virtool/data/`).
Never access databases directly from API handlers.

API modules should primarily define route declarations and thin request handlers.
Move reusable business logic, persistence decisions, resource shaping, and
cross-route helpers into the appropriate data-layer, domain, or support module
instead of growing the API module.

Data-layer domains own persistence, cross-resource consistency, data-derived
decisions, and the application/resource model shapes returned by operations.

API handlers own HTTP concerns: route/query/body parsing, request-context
authorization checks, status codes, headers, streaming response construction, and
translation from `Resource*` errors to `API*` errors.

Do not reshape a data-layer result into a different application/resource model
in an API handler to compensate for a missing data-layer operation. Add or adjust
a data-layer method instead. Legacy handlers that access Postgres directly
or reshape domain results are not precedent for new work.

### Legacy ID Migration

MongoDB has been fully removed — there is no Mongo client, no dual-write path,
and no collections left to migrate from. All domains that were migrated off
MongoDB now read and write PostgreSQL exclusively. What remains ongoing is
finishing the transition off the Mongo-era string IDs those domains carried
over: many tables still have a `legacy_id: String, nullable=True, unique=True`
column (the old Mongo `_id`) alongside their integer primary key, some are
still addressed externally by that string ID, and some cross-domain FKs are
still bare `String` columns pointing at another table's `legacy_id` instead of
an integer FK. Track this work per domain as separate Linear issues: "Todo" for
the FK/ID upgrade, "Backlog" for the final column drop (deferred until stable
in production).

Do not add a `legacy_id` column to a brand-new, Postgres-native table — that
column only exists to carry forward an identifier from a Mongo document that
no longer exists.

#### Querying by legacy or modern ID

While a domain still exposes its legacy string ID externally, use the helpers
in `virtool.data.topg`:

- Single-resource lookups: `compose_legacy_id_single_expression(Model, id_)`.
- Batch lookups (transforms, validation): `compose_legacy_id_multi_expression(Model, id_list)`.
- Resolving a legacy or modern ID to the integer PK: `resolve_legacy_id(session, Model, id_)`.
- Joining a not-yet-upgraded string FK column against an already-integer-keyed
  table: `compose_legacy_id_subquery(Model, id_)`.

Build dual-key lookup dicts so both integer and legacy string IDs resolve
correctly in transforms:

```python
lookup = {
    **{row.id: shape(row) for row in rows},
    **{row.legacy_id: shape(row) for row in rows if row.legacy_id},
}
```

#### Upgrading cross-domain references to integer FKs

Other domains that hold a bare `String` reference to a table (instead of an
integer FK) must be upgraded:

- Write an Alembic migration that **adds** a nullable integer `*_id` FK column,
  then backfill the string values to their integer PK equivalents in a
  downstream revision. Drop the legacy string column in a later cleanup
  revision after confirming production stability.
- Update any transform or lookup in the referencing domain that previously
  received a string ID.
- Once all cross-domain string references to a table are gone and its own
  external API no longer accepts legacy string IDs, drop its `legacy_id`
  column and remove the `compose_legacy_id_*`/`resolve_legacy_id` calls for
  it.

#### Dropping legacy columns (Backlog)

Deferred until a domain's integer-FK upgrade has been running in production
long enough to be confident. Leave these issues in "Backlog" for several
months.

- Drop the `legacy_id` column from the table (once every cross-domain
  reference to it is an integer FK and its public API is integer-only).
- Remove any other bridge columns or fields that were only needed during the
  transition.

### Error Handling

- **Data layer** (`virtool/data/errors.py`): Raises `ResourceNotFoundError`,
  `ResourceConflictError`, `ResourceNotModifiedError`, `ResourceRemoteError`.
- **API layer** (`virtool/api/errors.py`): Catches `Resource*` exceptions and
  re-raises as `APINotFound`, `APIBadRequest`, `APIConflict`, etc.
- **Middleware** (`error_middleware`): Catches all `APIException` instances and
  returns JSON with `id`, `message`, and optional `errors` fields.

### Vocabulary

Use **"delete"** for permanently destroying an entity. Use **"remove"** for
detaching an entity from a parent or collection without destroying it (e.g.,
removing an isolate from an OTU).

### Datetimes

Datetimes in Virtool are **naive UTC** — no `tzinfo` attached, always
representing UTC. Generate them with `virtool.utils.timestamp()`
(`arrow.utcnow().naive`), never `datetime.now()` or aware datetimes.

Postgres datetime columns use plain `DateTime` / `Mapped[datetime]`, **not**
`DateTime(timezone=True)`. Adding `timezone=True` would diverge from every
existing model and store offset-aware values that the rest of the codebase does
not expect.

### Lifecycle Filter Convention

For list endpoints that expose a boolean lifecycle field (e.g. `archived`),
filter on that field with a tri-state query parameter named after the field:

- absent / `null` → no constraint (both states)
- `{field}=true` → only entities where the field is `True`
- `{field}=false` → only entities where the field is `False`

Type the parameter as `bool | None = None`. This matches the existing
`verified` filter on `GET /references/v1/{ref_id}/otus`. Document the three
states in the OAS description. The canonical example is `archived` on
`GET /references/v1`.

## Code Style

- Don't include comments when it is clear what the code is doing.
- Always put imports at the top of a module.
- Ruff enforces all rules (`select = ["ALL"]`) with specific ignores. Test files
  have relaxed type annotation and docstring rules.

## Explicit Configuration, Loud Failures

Prefer explicit wiring and loud errors over silent fallbacks. A required
dependency that quietly defaults to *something plausible* will mask broken
configuration for weeks before anyone notices.

- Required constructor and factory parameters must be non-optional with no
  default. Do not write `dep: X | None = None` and then construct a fallback
  inside the function — that turns a forgotten caller into silent
  misbehaviour.
- Look up required app state with `app["key"]` (which raises `KeyError`), not
  `app.get("key")` (which returns `None`).
- Don't add production fallbacks to make tests easier. Tests pass explicit
  doubles (in-memory backends, tmp paths). Production code stays strict.
- When adding a new aiohttp entry point (API server, jobs server, task runner),
  audit `on_startup` against the other entry points. A missing
  `startup_*` is a wiring bug, not a runtime "use a sensible default" moment.
- Config values that have no safe default should validate at load time and
  raise. Don't silently coerce empty strings, `None`, or missing env vars to
  working-but-wrong values.

### Dictionary Access and Schema Contracts

Use direct dictionary access for fields that are required by the current schema
or by the code path's normalized input contract. Prefer loud failures
(`KeyError`, `ValueError`, validation errors) over defensive fallbacks when
missing data means the producer, transform pipeline, fixture, or database state
is malformed.

Use `dict.get()`, `get_safely()`, or similar safe access helpers only when the
field is genuinely optional or when multiple schema shapes are intentionally
supported. Do not use safe access "just in case" to avoid errors from unexpected
missing keys. That hides real contract violations and can silently turn broken
state into `None`, empty collections, skipped records, or misleading API
responses.

When safe access is appropriate, make the accepted shapes explicit in the code:
for example, distinguish absent/null linkage from malformed linkage objects, or
raise when none of the intentionally supported alternatives are present.

## Git

Commits follow [Conventional Commits](https://www.conventionalcommits.org).
Releases are automated with semantic-release.

- Use imperative mood: "fix bug" not "fixed bug"
- Scope is optional. Allowed scopes: `deps` (dependency changes), `migration`
  (commit adds or modifies a migration). Do not scope by domain.
- Keep titles concise, lowercase
- Include a body only when useful; keep it brief
- Only push or create PRs when asked
- Do not use `git -C` — it breaks allowed tools settings. Run git commands
  from the working directory instead.

`feat` and `fix` are the types that trigger a semantic-release version bump.
Their titles should describe the outcome, not the implementation:

- Bad: `feat: dual-write samples to mongo and postgres`
- Good: `feat: add samples to postgres`
- Bad: `fix: count otu list modified_count by otu id not name`
- Good: `fix: correct otu modification counts in list view`

Other types (`chore`, `refactor`, `test`, etc.) are developer-facing —
implementation details in the title are fine and make history easier to
search later.

### Pull Requests

PRs in this repo are squash-merged, so the PR title and body become the
commit title and body — write them as the commit you want in history, not as
a running log of the branch's work. The PR title must follow Conventional
Commits format (see above) so the squash lands as a well-formed commit.

Keep PR bodies short. Summarize what changed and why in a few sentences or
bullets. Do not add a "Test plan" section, a checklist of test commands, or a
list of behaviours to verify — those belong in the test suite, not the PR
body. If something genuinely cannot be covered by tests and requires manual
verification, mention only that specific item.

## Linear

Team name: Virtool
Team ID: `76cf3c46-c5d9-4df4-b457-0fc053d402f7`

New issues should use the "Python" label. Choose an appropriate status — don't
default to "Backlog". Bugs should go to "Todo".

### Issue Naming

- Capitalize issue titles.
- Keep Conventional Commit types and scopes out of titles (e.g. write "Fix
  sample creation" not "fix(samples): blah").

When using sub-agents to interact with Linear:
- Never update issue comments or status unless explicitly asked.
- Never create issues unless explicitly asked.
- When fetching images from descriptions, use the extract_images tool.
