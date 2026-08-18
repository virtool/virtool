# Documentation TODO

- [x] Move the detailed CI path-filter rationale from `AGENTS.md` to
  `docs/ci.md`. Keep only the rule that every new workflow image or crate input,
  including each Dockerfile `COPY` source, must be added to the corresponding
  filter in `.github/workflows/ci.yaml`.
- [x] Reduce the testing section in `AGENTS.md` to the essential conventions:
  explicit Vitest imports, one database per test file through
  `createTestDatabase()`, explicit assertions, and a single owner for each test
  double. Keep container setup, emitter-stubbing details, and rationale with
  their owning package and test helpers.
- [ ] Move code-style rationale and examples to `docs/code-style.md`. Retain
  short imperative rules in `AGENTS.md` for function declarations, React refs,
  types, exported-type JSDoc, comments, naming, and concurrent awaits. Fix the
  malformed `Refs` list label while editing the section.
- [ ] Move the detailed Conventional Commit taxonomy and examples to
  `CONTRIBUTING.md` or `docs/contributing.md`. Keep the title format, release
  implications, allowed scope, push/PR authorization rule, and prohibition on
  `Test plan` sections in `AGENTS.md`.
- [ ] Simplify the documentation-maintenance section to state where
  repository-wide rules, detailed rationale, and app/package documentation
  belong, plus a short checklist of changes that invalidate documentation.
- [ ] Remove low-value or redundant prose from `AGENTS.md`, including the
  explanation of `TZ=UTC`, assumptions such as “all checks must pass” and
  “main is green,” rhetorical anecdotes, and historical details already kept
  in leaf documentation.
