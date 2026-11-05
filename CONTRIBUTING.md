# Contributing

## Commit and pull request titles

Write titles in sentence case, in the imperative mood, with no prefix and no
period. Keep them under 72 characters. This matches the messages that Git,
GitHub, and Renovate generate.

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
must name that app in a change file, or `Knope / Check` fails.

Install Knope with `mise install`. The version is pinned in `mise.toml`.

Run `knope document-change`. Select the packages to bump, the change type
(`patch`, `minor`, `major`, or `maintenance`), and write a summary. The command
writes a Markdown file in `.changeset/`. Edit the file to add details, then
commit it with your change.

A change file has YAML front matter that lists Knope package names with a
change type. Each package can have a different type. The summary follows the
front matter:

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

A bundled app that is affected only through a shared package needs no change
file when its built code and its production dependencies do not change. For
example, a change to a web-only module in `@virtool/contracts` does not need a
change file for the workflows. See [Releases](docs/ci.md#releases).

A pull request that affects no image app needs no change file. Empty change files are not allowed.
Changes to tests, test data, and Markdown affect no app. When a pull request
affects an app but needs no release, such as a refactor, add the `no-release`
label. The label waives the check. To release a change that users can't see,
use `maintenance`.

Merging to `main` opens or updates a **Release** pull request that applies the
pending bumps and updates the changelogs. Merging it publishes the images and
creates the tags and GitHub Releases. See [Releases](docs/ci.md#releases).

### Release notes

The text of a change file becomes its entry in the changelog and in the
GitHub Release. Write it for users, not reviewers. Tell users what they will
see that is different, not how the code changed.

The first line is the summary. Keep it on one line, and leave a blank line
before any details: `Knope / Check` fails a summary that wraps. A change file
with only a summary becomes a bullet. Text after the summary becomes the
details: the summary becomes a heading, and the details go below it. Add
details when users must know more,
for example what was wrong before, what to do now, or which pages changed:

```md
---
virtool: patch
---

Return to the correct page after you sign in

When you open a Virtool link before you sign in, Virtool now takes you to that
page after you sign in. It keeps the search terms and filters in the link.
```

When administrators must do something after they upgrade, start that paragraph
of the details with `**Action required:**`. The Release pull request body
copies each of these paragraphs into an "Action required" section at the top.
The site changelog shows them in an "Action required" box at the top of the
release.

If users can't see the change, use `maintenance`. Examples are a schema
preparation, a change to how images build, and a dependency update. This type
releases a patch. `CHANGELOG.md` lists the change in a Maintenance section. The
GitHub Release and the Release pull request show that section collapsed.

A change that uses `maintenance` must not contain `**Action required:**`, or
`Knope / Check` fails. Use `patch`, `minor`, or `major` for that change, so that
the action stays in the main notes.

Run `knope prepare-release --dry-run` to see the changelog entry.

To reword notes before a release, edit the `.changeset/*.md` files on `main`.
The Release pull request is rebuilt from them on every push, so edits pushed to
it directly are lost when anything else merges first.

For a bigger release, add a change file that holds only the user-facing
summary, such as a `minor` bump for `virtool` with a few paragraphs of prose.

### Posts

A post is an optional article on the site, at `/posts`. There are two types:

| Type | Use |
| --- | --- |
| `release` | Explains a change in more detail than a changelog entry. The release in the changelog links to the post. |
| `research` | Tells users about work that is not part of a release, such as a paper. |

Add an MDX file to `apps/site/src/content/posts/`. If the post has images, put
the post in its own directory as `index.mdx`, with the images beside it. The
file or directory name is the slug, and the post URL is `/posts/<slug>`. Do not
change the slug after the post is published, because links use it.

Each post needs `type`, `title`, and `summary`. Write `summary` as one sentence,
because it shows in the post list. The build fails if a field is missing.

A `release` post also needs `pr`:

```mdx
---
type: release
title: Recover access with a one-time link
summary: Administrators now send recovery links instead of setting passwords.
pr: 4175
---

Write the post here.
```

A post cannot name its version, because Knope calculates the version later.
Set `pr` to the number of the pull request that makes the change. The build
finds that pull request in the `virtool` changelog, and gets the version and
date from that release. The pull request must have a change file that names
`virtool`, or the changelog will not contain it.

Until that release exists, the site hides the post. The build logs a warning
for each hidden post. If a post stays hidden after its release, make sure that
`pr` is correct.

A `research` post also needs `date`:

```mdx
---
type: research
title: A new method to find novel viruses
summary: Our paper describes how Virtool finds viruses absent from references.
date: 2026-12-01
---

Write the post here.
```

Merge a post through a normal pull request, not the Release pull request. A
release post can be in the same pull request as the change, or in a different
one. The site builds from the latest release, so a post goes live with the next
release, not on a date that you choose.

### Upgrade Knope

Renovate does not update `mise.toml`. To upgrade Knope, change `version` in
the `github:knope-dev/knope` entry of `mise.toml`, run `mise install`, and run
`knope --upgrade`. The last command migrates `knope.toml` when the
configuration syntax changes. Commit both files.
