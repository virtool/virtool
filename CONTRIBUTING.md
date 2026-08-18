# Contributing

## Commit and pull request titles

Use Conventional Commits for commit and pull request titles:

```
type(scope): description
```

The available types are:

- `feat`: a new user-facing feature or capability;
- `fix`: a bug fix or correction to user-visible behaviour, including UI and
  performance improvements;
- `chore`: internal code that is not yet exposed to users, configuration,
  dependencies, file moves, and build scripts;
- `refactor`: restructuring without a change in behaviour;
- `style`: formatting without logic changes;
- `docs`: documentation-only changes;
- `test`: test additions or updates;
- `ci`: CI/CD pipeline changes.

Write `feat` and `fix` descriptions as user outcomes. Put implementation
details in the commit or pull request body:

- Prefer `fix: correct submit button label` to
  `fix: use shared Button component with corrected label`.
- Prefer `fix: prevent rare data loss when saving` to
  `feat: wrap save handler in a transaction`.

Developer-facing types can describe the implementation directly:

- `refactor: extract form helpers into src/forms/`
- `chore: add csv parser`
- `test: add tests for table components and hooks`

Pull request titles follow the same format so the pull request can be
squash-merged into one well-formed commit.
