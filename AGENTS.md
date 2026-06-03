# Virtool

Viral infection diagnostics using next-generation sequencing. Python 3.13+ async
API server using aiohttp, with PostgreSQL and MongoDB backends.

## Tooling

### Testing

Tests run in Docker containers with PostgreSQL and MongoDB services.

```bash
# Run full test suite
mise run test

# Run specific tests with pytest args
mise run test -- tests/account -n4

# Update snapshots
mise run test -- --su

# Build test image
mise run test:build

# Shell into test container
mise run test:shell

# Stop test environment
mise run test:down
```

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

- `spawn_client` - test HTTP client (`VirtoolTestClient`)
- `fake` - `DataFaker` for creating test entities (`fake.users.create()`, etc.)
- `mongo` - function-scoped Motor database (dropped after each test)
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

Identifiers in test fixtures (Mongo `_id`s, fake names, etc.) should describe
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
  - `data/` - Unified data layer abstracting SQL and Mongo (`layer.py`)
  - `pg/` - PostgreSQL models and utilities (SQLAlchemy 2.0+, asyncpg)
  - `mongo/` - MongoDB utilities (motor)
  - `migration/` - Database migrations (Alembic)
  - `config/` - Configuration system
  - `jobs/` - Job queue and processing
  - `workflow/` - Workflow execution engine with pytest plugin
  - `authorization/` - Permission and policy system
  - `sessions/` - Session management
- `tests/` - Test suite (mirrors `virtool/` structure)
  - `fixtures/` - Shared pytest fixtures

### Entry Points

- `virtool server api` - Main API server (port 9950)
- `virtool server jobs` - Jobs API server
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
a data-layer method instead. Legacy handlers that access Mongo/Postgres directly
or reshape domain results are not precedent for new work.

### MongoDB Migration

We are gradually migrating away from MongoDB. New features should use
PostgreSQL.

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

## Git

Commits follow [Conventional Commits](https://www.conventionalcommits.org).
Releases are automated with semantic-release.

- Use imperative mood: "fix bug" not "fixed bug"
- Scope is optional: `feat:`, `fix:`, `chore(deps):`, etc.
- Keep titles concise, lowercase
- Include a body only when useful; keep it brief
- Only push or create PRs when asked
- Do not use `git -C` — it breaks allowed tools settings. Run git commands
  from the working directory instead.

### Pull Request Descriptions

Keep PR bodies short. Summarize what changed and why in a few sentences or
bullets. Do not add a "Test plan" section, a checklist of test commands, or a
list of behaviours to verify — those belong in the test suite, not the PR
body. If something genuinely cannot be covered by tests and requires manual
verification, mention only that specific item.

## Linear

Team name: Virtool
Team ID: `76cf3c46-c5d9-4df4-b457-0fc053d402f7`

New issues should use the "Backend" label. Choose an appropriate status — don't
default to "Backlog". Bugs should go to "Todo".

### Issue Naming

- Capitalize issue titles.
- Keep Conventional Commit types and scopes out of titles (e.g. write "Fix
  sample creation" not "fix(samples): blah").

When using sub-agents to interact with Linear:
- Never update issue comments or status unless explicitly asked.
- Never create issues unless explicitly asked.
- When fetching images from descriptions, use the extract_images tool.
