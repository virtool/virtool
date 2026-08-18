# Continuous integration

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
