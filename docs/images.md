# Images

Every image this repo ships is a target in the root `Dockerfile`, built
from the repo root. Each is a build stage and a runtime stage, and every
build stage shares `base`, which installs once from every workspace
manifest.

| Target | Image | App |
| --- | --- | --- |
| `dist` | `ghcr.io/virtool/ui` | `apps/web` |
| `jobs-api` | `ghcr.io/virtool/jobs-api` | `apps/jobs-api` |
| `tasks` | `ghcr.io/virtool/tasks` | `apps/tasks` |
| `create-sample` | `ghcr.io/virtool/ts-create-sample` | `apps/create-sample` |
| `create-subtraction` | `ghcr.io/virtool/ts-create-subtraction` | `apps/create-subtraction` |
| `pathoscope` | `ghcr.io/virtool/ts-pathoscope` | `apps/pathoscope` |
| `nuvs` | `ghcr.io/virtool/ts-nuvs` | `apps/nuvs` |

`dist` is named that rather than `web` because tooling outside this repo
targets it. There is also a `dev` stage carrying `apps/web` on the
install layer, which ships nothing.

## Every runtime stage is `node:24-bookworm-slim`

The workflow images carry bioinformatics binaries built on
`debian:bookworm` and dynamically linked against glibc, so at least one
image has to be glibc. One base shared by everything is worth more than
the ~70 MB Alpine would save on the images that could do without it — and
it is what lets `base` be shared rather than repeated once per libc. Do
not add an Alpine stage.

Two images additionally compile a Rust crate on `rust:1.97-bookworm`, in
cargo-chef stages that cook the dependencies in their own layer before
`src` is copied: pathoscope builds `packages/pathoscope-core`, and
create-sample builds `packages/quality-core`. Exactly one binary out of
each Rust build reaches a runtime stage.

**Each crate gets its own planner/builder pair, over a shared `chef`.**
`libclang-dev` goes in a `chef-pathoscope` stage rather than the shared
one, because only `pathoscope-core` needs it — putting it in the shared
stage would make every create-sample build pay for an apt install it has
no use for. This is the one-stage-per-tool rule below, applied to the
crates.

The nuvs image compiles SPAdes 4.2.0 from source, on `python:3.13-bookworm`,
because it ships no binary release this base can use — the recipe is
`virtool/workflow-nuvs`'s Dockerfile verbatim, version included, since the
assembler decides the contigs and a different one is a different analysis.
That stage depends on nothing else in the file, so a warm layer cache skips
it entirely regardless of what else changed.

## The install layer takes manifests by glob

`COPY --parents apps/*/package.json packages/*/package.json ./` preserves
directory structure — a plain `COPY apps/*/package.json apps/` flattens
them all onto one path. That needs the
`# syntax=docker/dockerfile:1-labs` parser directive on the first line of
the file. Adding a workspace must not mean editing a list of `COPY`
lines.

**Package *source*, though, is copied one `COPY` per package.** The glob
above matches manifests only, so it skips `packages/pathoscope-core` and
`packages/quality-core`, which are Rust crates with no `package.json`. A
blanket `COPY packages ./packages` would pull their `src/` and
`Cargo.lock` into the layer and bust its cache on every Rust edit. Add a
line when a new TypeScript package appears.

**App source is copied per build stage, not in `base`.** A change to
`apps/web` then does not invalidate the jobs-api image's cache, and the
install layer stays untouched when an app is added.

## The bioinformatics tools are built here, one stage each

`bowtie2`, `cd-hit`, `hmmer`, `pigz`, `samtools`, `seqkit` and `skewer`
each get a stage near the top of the `Dockerfile`, installing to
`/tools/<tool>/<version>/`, and the workflow runtime stages copy out of
them. They were `ghcr.io/virtool/tools`, a separate repo; the recipes
here are that repo's `install_*.sh` scripts verbatim, down to the
upstream URLs and the layout.

**One stage per tool, never one combined stage.** BuildKit builds only
the stages the requested target reaches, so `--target create-subtraction`
compiles nothing but seqkit. A combined stage would have every workflow
image build every tool. None of these stages depends on `base` or reads
the build context, so — exactly like the SPAdes stage — a warm layer
cache skips all of them regardless of what changed in the repo.

Two conventions inside the block differ from the rest of the file and are
deliberate: recommended packages are *not* suppressed, because these
stages contribute no bytes to any shipped image and `bioperl`'s
recommends are part of what makes HMMER's `make` work; and `skewer` is
built on `debian:bullseye` rather than bookworm, which is what the tools
repo did.

## Not every tool is a binary

A runtime stage carrying one has to install interpreters as well as
shared libraries. Check a new tool's entry point rather than assuming it
is an ELF, and check it against the pinned version this file builds
rather than against upstream's current source:

```
docker build --target <tool> -t vt-tool .
docker run --rm vt-tool head -1 /tools/<tool>/<version>/<tool>
```

A missing interpreter does not fail the build. It fails the first time
that step runs, in a pod, as `env: '<interpreter>': No such file or
directory` — long after the image passed CI. Which interpreters a given
image needs is that app's business; `apps/pathoscope/README.md` carries
the worked example.

**An interpreter being present is not the same as being complete.** The
`perl-base` this base carries has no `FindBin`, and the JRE a Java tool
needs is not there at all — a launcher script can name several things,
and each missing one fails at exec rather than at build. `nuvs` is the
live example, installing `python3` for SPAdes.

## Building and publishing

CI builds five of the seven in a matrix (`build`), and publishes the same
five from a second matrix (`release-ghcr`) on a release. **Keep the two
lists in step** — an app added to one and not the other either goes
unbuilt on pull requests or unpublished on release, and neither fails
anything.

Adding an app to the repo needs no Dockerfile edit until it needs an
image; adding an *image* needs a stage here and an entry in both
matrices.

**Pathoscope and nuvs are the odd two, and both are built but
deliberately not published.** Each has its own build job
(`build-pathoscope`, `build-nuvs`) with no publish counterpart, because
`virtool/workflow-pathoscope` and `virtool/workflow-nuvs` still release
those workflows, and a second pipeline shipping either from here would
leave two candidates for what the cluster runs. Restore a publish job for
one when its Python repo retires. Note that `release-ghcr` is also what
stamps a real version, so until then `APP_VERSION` is `0.0.0` in every
built pathoscope or nuvs image, and the `workflow_version` in their cache
keys with it.

Both build jobs, plus `pathoscope-test` and `quality-test`, are the only
path-filtered jobs in `ci.yaml`, and they take a filter each because
their inputs differ: the two crate jobs run cargo and read no TypeScript,
while `build-pathoscope` and `build-nuvs` bundle their app on the shared
`base` and so take every workspace package their build stage copies.
`pathoscope-test` also carries `Dockerfile`, because it builds the
`bowtie2` target to get the binary its golden vectors shell out to.

**Everything a build stage `COPY`s must appear under that image's
filter** — a missing path skips the build on the pull request that breaks
it and fails on the push to `main`, where nothing gates it. The two image
filters are nearly identical and are kept separate rather than merged,
because nuvs copies `packages/bio` and pathoscope copies
`packages/pathoscope-core`, and folding them into one would rebuild each
image for the other's inputs.

Build a single image locally by naming its target:

```
docker build --target pathoscope .
```
