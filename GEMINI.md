# Virtool Codebase Requirements

## Technical Stack
- **Language**: Python 3.13
- **Dependency Management**: `uv` (requires `uv.lock` updates for new dependencies)
- **Web Framework**: `aiohttp.web`
- **Data Validation**: Pydantic v1.10.16 (Strictly adhere to this version)
- **Databases**:
    - **MongoDB**: Primary document store via `motor`.
    - **PostgreSQL**: Relational store via `sqlalchemy` (async) and `asyncpg`.
    - **Redis**: Caching and messaging.
- **Migrations**: Alembic for PostgreSQL (`assets/alembic`).

## Coding Standards
- **Linting & Formatting**: `ruff` is used for both. Always run:
    - `ruff check . --fix`
    - `ruff format .`
- **Pre-commit**: This project uses `pre-commit`. Install it with `pre-commit install` to ensure checks run automatically on commit.
- **Typing**: Use static type hints for all new code. Use `from __future__ import annotations` where appropriate.
- **Asynchronous Code**: This is an asynchronous codebase. Prefer `async/await` and non-blocking libraries.
- **Pydantic Models**: Ensure models are compatible with Pydantic v1.10.x.
- **Error Handling**: Use the project's established error patterns in `virtool/errors.py` and `virtool/api/errors.py`.
- **Comments**: Don't include redundant comments when the code is self-documenting.
- **Imports**: Always place imports at the top of the module.

## Testing Requirements
- **Framework**: `pytest`
- **Plugins**: `pytest-asyncio`, `pytest-aiohttp`, `pytest-mock`.
- **Snapshots**: `syrupy` is used for snapshot testing.
- **Mandatory**:
    - Every bug fix MUST have a reproduction test case.
    - Every new feature MUST have comprehensive test coverage.
    - Use the `fake` fixture (`DataFaker`) to generate test data (e.g., `await fake.jobs.create()`) instead of manually inserting into databases.
- **Commands**:
    - Use `mise run test` to run tests and infrastructure.
    - Pass through arguments to pytest like: `mise run test -- tests/account -n4`.
- **Database Testing**: Use existing fixtures in `tests/` for MongoDB and PostgreSQL.

## Workflow & Safety
- **Migrations**:
    - Use `virtool migration create` to generate new Virtool migrations.
    - When modifying Postgres schemas, generate a new Alembic migration in `assets/alembic/versions`.
- **Documentation**: New features should be documented in `docs/` using Sphinx (RST).
- **Security**:
    - NEVER commit secrets or `.env` files.
    - Use `bcrypt` for password hashing.
- **Commits**: Follow the project's commit message style (clear, concise, focused on "why").

## Project Structure
- `virtool/`: Core application logic, organized by domain.
- `tests/`: Test suite, mirroring `virtool/` structure.
- `assets/alembic/`: Database migrations.
- `docs/`: Sphinx documentation.
