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

## Change files

Releases are driven by change files, not by commit types. Knope reads the
change files and releases the images. A pull request that affects an image app
must name that app in a change file, or the `Changeset` check fails.

Install Knope with `mise install`. The version is pinned in `mise.toml`.

Run `knope document-change`. Select the packages to bump, the bump level
(`patch`, `minor`, or `major`), and write a one-line summary. The command writes
a Markdown file in `.changeset/`. Commit it with your change.

A change file has YAML frontmatter that lists Knope package names with a bump
level. The summary follows it:

```md
---
virtool: patch
pathoscope: minor
---

Fix the sample table sort order
```

Write the names without quotes. These are the Knope packages:

| Name | Releases |
| --- | --- |
| `virtool` | The web and internal images, with one shared version |
| `create-sample` | The Create Sample image |
| `create-subtraction` | The Create Subtraction image |
| `pathoscope` | The Pathoscope image |
| `nuvs` | The Nuvs image |

The check finds the apps that your pull request affects through the workspace
graph. A change to a shared `packages/*` workspace affects every app that
depends on it. A change to an image build input affects the apps that use it.
For example, a change to `@virtool/pathoscope-core` affects Pathoscope, and a
change to `@virtool/workflow-tools` affects every workflow that uses it. You
name the affected apps in the change file. Knope does not cascade bumps.

A pull request that affects no image app needs no change file. Empty change files are not allowed.
When a pull request affects an app but ships nothing to
users, such as a refactor, a test, or a CI tweak, add the `no-release` label.
The label waives the check.

Merging to `main` opens or updates a **Release** pull request that applies the
pending bumps and updates the changelogs. Merging it publishes the images and
creates the tags and GitHub Releases. See [Releases](docs/ci.md#releases).

### Release notes

The summary of a change file becomes its entry in the changelog and in the
GitHub Release. Write it for users, not reviewers.

To reword notes before a release, edit the `.changeset/*.md` files on `main`.
The Release pull request is rebuilt from them on every push, so edits pushed to
it directly are lost when anything else merges first.

For a bigger release, add a change file that holds only the user-facing
summary, such as a `minor` bump for `virtool` with a few paragraphs of prose.

### Upgrade Knope

Dependabot does not update `mise.toml`. To upgrade Knope, change `version` in
the `github:knope-dev/knope` entry of `mise.toml`, run `mise install`, and run
`knope --upgrade`. The last command migrates `knope.toml` when the
configuration syntax changes. Commit both files.
