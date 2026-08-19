# Continuous integration

## Images

Every image ships from a target in the root `Dockerfile`. Five targets use the
`build` job matrix; Pathoscope and Nuvs have separate, longer path-filtered
jobs. `release-ghcr` publishes all seven targets on every release.

| Target | Published image | Build job |
| --- | --- | --- |
| `dist` | `ghcr.io/virtool/web` | `build` |
| `jobs-api` | `ghcr.io/virtool/jobs-api` | `build` |
| `tasks` | `ghcr.io/virtool/tasks` | `build` |
| `create-sample` | `ghcr.io/virtool/ts-create-sample` | `build` |
| `create-subtraction` | `ghcr.io/virtool/ts-create-subtraction` | `build` |
| `pathoscope` | `ghcr.io/virtool/ts-pathoscope` | `build-pathoscope` |
| `nuvs` | `ghcr.io/virtool/ts-nuvs` | `build-nuvs` |

`dist` retains its name because tooling outside this repository targets it.
The release tagged the same build as `ghcr.io/virtool/ui` as well while the
cluster migrated to `web`. That tag is no longer written, so the `ui` tags
still in the registry are frozen at the last release that carried them.

The `ts-` prefix distinguishes these workflow images from the unprefixed names
such as `ghcr.io/virtool/pathoscope` that earlier releases used. Nothing
publishes the unprefixed names now, so the prefix is retained only so an
existing deployment keeps pulling what it already pulls.

Adding an image requires a Dockerfile target and a release-matrix entry. For
the five targets in `build`, keep its matrix entry in step with
`release-ghcr`. Pathoscope and Nuvs instead use the dedicated build jobs above
and release entries whose `cache-scope` values are `pathoscope` and `nuvs`.
Those overrides reuse the caches populated by the long build jobs rather than
rebuilding the Rust crate, bioinformatics tools, or SPAdes inside the shared
20-minute release timeout.

Build one image locally by naming its target:

```console
docker build --target pathoscope .
```

## Path-filtered jobs

Most CI jobs run for every pull request. Four expensive jobs use the `changes`
job in `.github/workflows/ci.yaml` to run only when their inputs change:

| Filter | Job | Inputs |
| --- | --- | --- |
| `pathoscope-crate` | `pathoscope-test` | The Pathoscope Rust crate and the Dockerfile target that supplies Bowtie 2 |
| `quality-crate` | `quality-test` | The quality-statistics Rust crate |
| `pathoscope-image` | `build-pathoscope` | The Pathoscope app, its Rust crate, and everything copied into its image |
| `nuvs-image` | `build-nuvs` | The Nuvs app and everything copied into its image |

Keep a separate filter for each job. The crate jobs run Cargo and do not read
TypeScript sources. The image jobs bundle different apps and have different
Docker build inputs: Pathoscope copies `packages/pathoscope-core`, while Nuvs
does not. Combining the filters would run the libclang-and-Cargo job for
unrelated workspace changes and rebuild each image for inputs used only by the
other image.

Extend a filter in the same change that gives its job a new input. Every path a
workflow image's Dockerfile stages `COPY` must appear under that image's
filter, even when the app does not import it. The shared `base` stage copies
`packages/data`, `packages/service`, and `packages/bio` for both targets, so
both image filters include all three packages. Image filters also include
`.dockerignore`, because its rules determine which files are available to
those `COPY` instructions.

A missing input can skip the affected build on the pull request that changes
it. Pushes to `main` do not use the filters, so the same change can then fail
after merging.
