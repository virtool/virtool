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
the five targets in `build`, keep its matrix entry in step with
`release-ghcr`. Pathoscope and Nuvs instead use the dedicated build jobs
above, and their `matrix.image` values must match the cache scopes those jobs
write, so the release reuses the caches they populated rather than rebuilding
the Rust crate, bioinformatics tools, or SPAdes inside the shared 20-minute
release timeout.

See [Images](../README.md#images) to build one image locally.

## Affected jobs

The `changes` job asks pnpm for workspaces selected by
`...\[origin/main\]`. The leading ellipsis includes dependents, so an app is
selected when either its own files or any workspace dependency changes. The
expensive image and native-tool jobs, plus the per-app Nuvs test job, run only
for selected workspaces on pull requests and remain unconditional on pushes to
`main`.

CI first runs the app's build and then `pnpm --prod deploy`, making the Docker
context exactly the production closure recorded in the workspace graph. The
Rust crates and shared native-tool recipe are private pnpm workspaces used as
development dependencies by the apps that consume their build products. This
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
versioned on their own and cascade a `patch` into the apps that depend on them. `apps/site` is in `ignore` — it deploys
elsewhere and ships no image. The Rust crates, `workflow-tools`, and
`image-build` and `tsconfig` build-input workspaces are also ignored: they exist in pnpm only
to express image build edges and are released through their consuming apps.

The `release` job runs `changesets/action` on every push to `main`, after the
same build and test jobs that gate a pull request:

1. While unreleased changesets exist, the action maintains a **Version
   Packages** pull request. Its `version` script runs `changeset version`, which
   applies the bumps, updates each `CHANGELOG.md`, and deletes the consumed
   changesets. A `packages/*` bump cascades a `patch` into dependent apps.
2. Merging that pull request lands the bumps with no changesets left. The next
   push runs the `publish` script, `changeset tag`, which creates and pushes a
   git tag per bumped workspace in the form `@virtool/web@1.2.3`.

The action's `publishedPackages` output lists every tagged workspace.
`release-ghcr-matrix` maps that list to image builds, keeping only the deployable
apps — a `packages/*` bump tags a package but ships no image — and
`release-ghcr` builds each at the version in its tag, publishing `:<version>`
and `:latest`. A release that bumped only shared packages publishes no image.

The `Changeset` check fails a pull request that changes a versioned workspace
without a changeset. See [CONTRIBUTING.md](../CONTRIBUTING.md#changesets) for how
to add one.
