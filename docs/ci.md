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

See [Images](../README.md#images) to build one image locally.

## Affected jobs

The `changes` job asks pnpm for workspaces selected by `...\[<base>\]`. The
leading ellipsis includes dependents, so an app is selected when either its own
files or any workspace dependency changes. The build and test jobs run only for
selected workspaces. `Checks` and `Docs / Lint` run on every change.
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

Versioning and publishing run on [Changesets](https://github.com/changesets/changesets).
Every app and TypeScript package is `private`, so nothing publishes to npm; the config sets
`privatePackages: { version: true, tag: true }` to version and tag them anyway.
The `web` and `internal` images are a `fixed` group: they share one unified
version and bump together, so a change to either publishes both at the same
version. Create Sample, Create Subtraction, Pathoscope, and Nuvs are versioned
independently and publish only when they change. Shared `packages/*` are
versioned on their own and cascade a `patch` into the apps that depend on them. Image build inputs, which are the Rust crates,
`workflow-tools`, and `image-build`, cascade the same way. `apps/site` is in
`ignore`: it deploys elsewhere and ships no image. The development apps and
`tsconfig` are also ignored.

The `release` job runs `changesets/action` on every push to `main`, after the
same build and test jobs that gate a pull request:

1. While unreleased changesets exist, the action maintains a **Version
   Packages** pull request. Its `version` script runs `changeset version`, which
   applies the bumps, updates each `CHANGELOG.md`, and deletes the consumed
   changesets. A `packages/*` bump cascades a `patch` into dependent apps.
2. Merging that pull request lands the bumps with no changesets left. The next
   push runs the `publish` script, `changeset tag`, which creates a git tag per
   bumped workspace in the form `@virtool/web@1.2.3`. The action pushes the tags
   and creates a GitHub Release for each one, using that version's
   `CHANGELOG.md` entry as the body.

The action rebuilds the Version Packages branch from `main` on every push, so
commits pushed to it last only until the next merge. A pull request opened with
`GITHUB_TOKEN` never starts its own CI, so the action opens it as the
`virtool-releaser` GitHub App, which holds write access to contents and pull
requests on this repository only. The `RELEASER_CLIENT_ID` Actions variable and
`RELEASER_PRIVATE_KEY` secret identify the app. The `Changeset` check skips the
pull request.

The action's `published-packages` output lists every tagged workspace.
`release-ghcr-matrix` maps that list to image builds, keeping only the deployable
apps. A `packages/*` bump tags a package but ships no image. `release-ghcr`
builds each at the version in its tag, publishing `:<version>`
and `:latest`. A release that bumped only shared packages publishes no image.

The `Changeset` check fails a pull request that changes a versioned workspace
that none of its changesets release, directly or by cascade. See
[CONTRIBUTING.md](../CONTRIBUTING.md#changesets) for how to add one.

Dependabot writes no changesets. The **Dependabot** workflow adds one
changeset to each Dependabot npm or Docker pull request. A bump that changes the
`package.json` or Dockerfile of a versioned workspace releases a patch of each
such workspace. A bump that reaches only the root `package.json` or an ignored
workspace, such as a lint tool or the product website, ships nothing, so the
changeset is empty. A bump that changes only the lockfile, such as a transitive
security update, names no workspace, so the changeset releases every app that
ships an image. The workflow pushes the changeset as the `virtool-releaser`
GitHub App for the same reason the release job does.
