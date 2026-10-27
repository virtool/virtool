# Contributing

## Commit and pull request titles

Write titles in sentence case, in the imperative mood, with no prefix and no
period. Keep them under 72 characters. This matches the messages that Git,
GitHub, and Dependabot generate.

Write user-facing changes as user outcomes. Put implementation details in the
commit or pull request body:

- Prefer `Correct submit button label` to
  `Use shared Button component with corrected label`.
- Prefer `Prevent rare data loss when saving` to
  `Wrap save handler in a transaction`.

Developer-facing changes can describe the implementation directly:

- `Extract form helpers into src/forms/`
- `Add CSV parser`
- `Add tests for table components and hooks`

Pull request titles follow the same format so the pull request can be
squash-merged into one well-formed commit.

## Changesets

Releases are driven by [Changesets](https://github.com/changesets/changesets),
not by commit types. Each versioned workspace that a pull request changes must
be released by one of its changesets, or the `Changeset` check fails.

Run `pnpm changeset`, select the workspaces to bump and the bump level (`patch`,
`minor`, or `major`), and write a one-line summary. The command writes a Markdown
file under `.changeset/`; commit it with your change. A shared `packages/*` bump
cascades a `patch` into every app that depends on it, so you only declare the
package you changed.

Image build inputs cascade the same way. A changeset for
`@virtool/pathoscope-core` also releases Pathoscope, and one for
`@virtool/workflow-tools` releases every workflow that uses it.

`@virtool/tsconfig` is ignored. If a change to it alters an app's build output,
add a changeset for that app.

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
