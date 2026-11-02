# Continuous integration

## Images

Every image ships from its app's Dockerfile. The image-build Bake file preserves the
existing target names and links workflow apps to the shared native-tool stages
in `packages/workflow-tools/Dockerfile`. Four images use the `build` job matrix;
Pathoscope and Nuvs have separate, longer affected-only jobs. `release-ghcr`
publishes only the targets whose app version bumped in a release (see
[Releases](#releases)).

The [image table](../README.md#images) lists each target and its published
image.

`dist` retains its name because tooling outside this repository targets it.

Adding an image requires an app Dockerfile, a Bake target, and a release-matrix entry. For
the four targets in `build`, keep its matrix entry in step with
`release-ghcr`. Pathoscope and Nuvs instead use the dedicated build jobs
above. Their `matrix.image` values must match the cache scopes those jobs
write, so the release reuses the caches they populated rather than rebuilding
the Rust crate and bioinformatics tools inside the shared 20-minute
release timeout.

Only pushes to `main` write the image build caches. Pull requests read them
but don't write them. A cache that a pull request writes is visible only to
that pull request. These writes also make the repository go above GitHub's
10 GB Actions cache limit, and GitHub then removes the layers that `main`
wrote.

See [Images](../README.md#images) to build one image locally.

## Affected jobs

The `changes` job asks pnpm for workspaces selected by `...\[<base>\]`. The
leading ellipsis includes dependents, so an app is selected when either its own
files or any workspace dependency changes. The build and test jobs run only for
selected workspaces. `Checks` runs on every change.
`Packages / Test` runs only the selected workspaces that have a `test` script
and no dedicated job.

On a pull request, the base is `origin/main`. On a push to `main`, the base is
the head commit of the last successful push run. A newer push cancels a
pending run, and a failed run must not let the next push skip what it broke,
so `github.event.before` is not sufficient. If there is no successful run, or
its commit is not an ancestor of the push, every workspace is selected.

Root files have no dependents in the graph. Thus a change to a shared root
input, such as the lockfile or the CI workflow, selects every workspace.

The `release` job needs every build and test job. It runs when they pass or
skip, and stops when one fails or is cancelled.

CI first runs the app's build and then `pnpm --prod deploy`, making the Docker
context exactly the production closure recorded in the workspace graph. The
web image is the exception: its `.output` bundle carries its own dependencies,
so it builds from the app directory, and a `.dockerignore` limits the context
to `.output` and `package.json`. The
Rust crates and shared native-tool recipe are private pnpm workspaces, listed
as dependencies of the apps that consume their build products. Each one sets
`"files": ["package.json"]`, so the deployed context gets only an empty
package. This
lets the same graph select Pathoscope for a Pathoscope crate change, Create
Sample for a quality crate change, and both native workflows for a shared-tool
recipe change without hand-maintained path lists.

## Releases

Versioning runs on [Knope](https://knope.tech), and CI publishes. Every app and
TypeScript package is `private`, so nothing publishes to npm. Only the six
images are released.

`knope.toml` declares five Knope packages. `virtool` holds the `web` and
`internal` apps. They share one version, one changelog (`CHANGELOG.md` at the
repository root), one tag, and one GitHub Release. `create-sample`,
`create-subtraction`, `pathoscope`, and `nuvs` are versioned independently, each
with its own changelog in its app directory. `packages/*`, `apps/site`, and the
development apps are not Knope packages, so they have no releases.

Pending changes are Markdown files in `.changeset/`. Each file lists Knope
package names with a bump level, then a summary. Knope reads every Markdown
file in that directory, so it holds nothing else. The summary becomes the
changelog entry, with a link to its pull request. See
[CONTRIBUTING.md](../CONTRIBUTING.md#change-files) for how to add one.

The `release` job runs on every push to `main`, after the same build and test
jobs that gate a pull request:

1. While change files exist, the job runs `knope prepare-release` on branch
   `knope/release`. It formats the changed `package.json` files, force-pushes
   the branch, and opens or updates a pull request titled **Release**. The body
   holds the new changelog sections. Merging it applies the bumps, updates the
   changelogs, and deletes the consumed change files.
2. The job finds each Knope package whose `package.json` version has no tag.
   `virtool` tags are the plain version, such as `42.61.2`, which continues the
   earlier semantic-release tags. Other tags are `<name>@<version>`, such as
   `create-sample@42.61.2`. `release-ghcr` builds each of those images at the
   commit that last changed that version, and publishes `:<version>` and
   `:latest`. Then `release-github` creates the tag and a GitHub Release for
   each package at that same commit. The Release title is the tag, and the body
   is that version's changelog section. Only the `virtool` Release is marked
   latest. A Release exists only after its image is pushed.

The release pull request merge removes the change files, so its push takes the
second path. A push with no untagged version publishes nothing.

If an image leg fails, `release-github` does not run. Re-run the failed jobs of
that workflow run. A later push also retries the release, and it builds from
the same commit, so the images do not include changes made after the release.

Knope's own `Release` step adds a `v` to each tag, so CI does not use it. A
script creates the tags and Releases with `gh release create`. It skips a tag
that exists, so a re-run makes only the missing Releases. If a changelog has no
section for the version, the job fails before it creates a Release.

The Release branch is rebuilt from `main` on every push, so commits pushed to it
last only until the next merge. A pull request opened with `GITHUB_TOKEN` never
starts its own CI, so the job pushes and opens it as the `virtool-releaser`
GitHub App. The app holds write access to contents and pull requests on this
repository only. The `RELEASER_CLIENT_ID` Actions variable and
`RELEASER_PRIVATE_KEY` secret identify the app. The `Knope / Check` job skips
the Release pull request, but not a fork branch with the same name.

The `Knope` workflow exists because `Knope / Check` must run again when a
label changes. If CI listened to label events, each label change would start all
of CI again. The check does the following:

- It rejects a malformed change file: a front matter line that is not exactly
  `<name>: major|minor|patch`, an unknown or quoted package name, a package
  named twice, empty front matter, or a missing summary.
- It finds the image apps that the pull request affects through the workspace
  graph, and requires that some change file names each one. A docs- or CI-only
  pull request affects no image app and needs no change file.
- The `no-release` label waives the second rule. It does not waive the first.

Knope is installed with `mise` from the pin in `mise.toml`. Renovate does not
update that pin. See [CONTRIBUTING.md](../CONTRIBUTING.md#upgrade-knope).

## Dependency updates

Renovate runs in the **Renovate** workflow every two hours, not as the hosted
app. The repository config holds the update rules. The workflow holds the
settings that Renovate reads only from a self-hosted configuration, such as the
list of allowed post-upgrade commands.

Renovate opens these pull requests:

- One for minor and patch updates of production dependencies, and one for
  development dependencies, each Monday.
- One for each major update. Packages from the same monorepo move together.
- One for `better-auth` and SimpleWebAuthn together, for all update types. The
  passkey plugin must resolve the same SimpleWebAuthn copy as the app.
- One for GitHub Actions on the first day of each month.
- One for the Node base image digest at any time. Only the Node image reaches
  published images, so Renovate ignores the other Docker images. Node versions
  change only by hand.
- One for each security fix found in the OSV database, at any time.

Renovate does not change the pnpm overrides. Each one pins a vulnerable range
of a transitive dependency, so it changes only by hand.

The **Dependency Dashboard** issue lists the pending and postponed updates.

Each Renovate npm or Docker branch gets its change file in the same commit as
the bump. Renovate runs a script as a post-upgrade task, once for each branch:

- A bump that changes the `package.json` or Dockerfile of a workspace releases a
  patch of each Knope package that the workspace reaches.
- A bump that reaches only the root `package.json` or workspaces that ship no
  image, such as a lint tool or the product website, ships nothing, so the
  script writes no change file. The check passes those pull requests.
- A bump that changes only the lockfile names no workspace, so the change file
  releases every Knope package.

Renovate bumps the range in `package.json` even when the range already allows
the new version. Otherwise, the bump would change only the lockfile and release
every image.

Each change file name has a hash of its updates and their digests, because a
group branch name comes back each week while the change file of the last merge
can still wait on `main` for a release. When Renovate updates a branch in place,
the script deletes the change file of its last run first.

Renovate pushes and opens pull requests as the `virtool-renovator` GitHub App,
because a pull request opened with `GITHUB_TOKEN` never starts CI. The
`RENOVATOR_CLIENT_ID` Actions variable and `RENOVATOR_PRIVATE_KEY` secret
identify the app. It is separate from `virtool-releaser`, because Renovate also
needs write access to issues and workflows.
