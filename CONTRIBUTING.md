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
- `chore`: internal code that's not yet exposed to users, configuration,
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

## Changesets

Releases are driven by [Changesets](https://github.com/changesets/changesets),
not by commit types. A pull request that changes a versioned workspace must add
a changeset, or the `Changeset` check fails.

Run `pnpm changeset`, select the workspaces to bump and the bump level (`patch`,
`minor`, or `major`), and write a one-line summary. The command writes a Markdown
file under `.changeset/`; commit it with your change. A shared `packages/*` bump
cascades a `patch` into every app that depends on it, so you only declare the
package you changed.

Build-only workspaces are ignored by Changesets and linked to their consuming
apps through `devDependencies`. Changesets does not propagate releases through
development dependencies, so changes to these workspaces must name their
consumer apps directly:

- `@virtool/image-build`: all shipped apps
- `@virtool/workflow-tools`: Create Sample, Create Subtraction, Pathoscope, and
  Nuvs
- `@virtool/pathoscope-core`: Pathoscope
- `@virtool/quality-core`: Create Sample
- `@virtool/tsconfig`: every shipped app whose generated output changes

For a change that ships nothing to users, such as a refactor, a test, or a CI
tweak, record an empty changeset with `pnpm changeset --empty`.

Merging to `main` opens an automated **Version Packages** pull request that
applies the pending bumps and updates each `CHANGELOG.md`; merging that pull
request tags the bumped workspaces and publishes the affected images. See
[Releases](docs/ci.md#releases).

### Release notes

The summary of a changeset becomes its entry in the workspace's `CHANGELOG.md` and
in the GitHub Release. Write it for users, not reviewers.

To reword notes before a release, edit the `.changeset/*.md` files on `main`.
The Version Packages pull request is rebuilt from them on every push, so edits
pushed to it directly are lost when anything else merges first.

For a bigger release, add a changeset that holds only the user-facing summary,
such as a `minor` bump for `@virtool/web` with a few paragraphs of prose.
