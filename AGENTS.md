# Virtool

Viral infection diagnostics using next-generation sequencing. Python 3.13+ async
API server using aiohttp, with PostgreSQL, MongoDB, and Redis backends.

## Tooling

### Testing

Tests run in Docker containers with PostgreSQL, MongoDB, and Redis services.

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

### Test Conventions

Tests mirror the source tree: `virtool/account/` → `tests/account/`. Files are
named `test_*.py`.

All shared fixtures live in `tests/fixtures/` (not conftest.py). Key fixtures:

- `spawn_client` - test HTTP client (`VirtoolTestClient`)
- `fake` - `DataFaker` for creating test entities (`fake.users.create()`, etc.)
- `mongo` - function-scoped Motor database (dropped after each test)
- `pg` / `engine` - session-scoped SQLAlchemy `AsyncEngine`
- `redis` - function-scoped Redis client (flushed after each test)
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

### Other Commands

```bash
# Generate OpenAPI spec
mise run oas
```

### Migrations

Use `virtool migration create` to write new Virtool migrations (Alembic-based).

## Architecture

### Key Directories

- `virtool/` - Main package
  - `api/` - API middleware and route handlers
  - `data/` - Unified data layer abstracting SQL/Mongo/Redis (`layer.py`)
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
- `virtool tasks runner` - Task runner (pulls from Redis)
- `virtool tasks spawner` - Task scheduler

### Data Layer

Request handlers must always go through data layer domains (`virtool/data/`).
Never access databases directly from API handlers.

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

## Code Style

- Don't include comments when it is clear what the code is doing.
- Always put imports at the top of a module.
- Ruff enforces all rules (`select = ["ALL"]`) with specific ignores. Test files
  have relaxed type annotation and docstring rules.

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

## Linear

Team name: Virtool
Team ID: `76cf3c46-c5d9-4df4-b457-0fc053d402f7`

New issues should use the "Backend" label. Choose an appropriate status — don't
default to "Backlog". Bugs should go to "Todo".

When using sub-agents to interact with Linear:
- Never update issue comments or status unless explicitly asked.
- Never create issues unless explicitly asked.
- When fetching images from descriptions, use the extract_images tool.
