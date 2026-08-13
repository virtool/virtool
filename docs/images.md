# Images

Every image this repo ships is a target in the root `Dockerfile`, built
from the repo root. Each is a build stage and a runtime stage, and every
build stage shares `base`, which installs once from every workspace
manifest.

| Target | Image | App |
| --- | --- | --- |
| `dist` | `ghcr.io/virtool/ui`, `ghcr.io/virtool/web` | `apps/web` |
| `jobs-api` | `ghcr.io/virtool/jobs-api` | `apps/jobs-api` |
| `tasks` | `ghcr.io/virtool/tasks` | `apps/tasks` |
| `create-sample` | `ghcr.io/virtool/ts-create-sample` | `apps/create-sample` |
| `create-subtraction` | `ghcr.io/virtool/ts-create-subtraction` | `apps/create-subtraction` |
| `pathoscope` | `ghcr.io/virtool/ts-pathoscope` | `apps/pathoscope` |
| `nuvs` | `ghcr.io/virtool/ts-nuvs` | `apps/nuvs` |

`dist` is named that rather than `web` because tooling outside this repo
targets it. There is also a `dev` stage carrying `apps/web` on the
install layer, which ships nothing.

`dist` is released under both `ghcr.io/virtool/ui` and
`ghcr.io/virtool/web` — one build, tagged twice by `release-ghcr`'s
`docker/metadata-action` step — while the cluster migrates off the
`ui` name. Drop the `ui` tag once nothing pulls it.

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

`bowtie2`, `cd-hit`, `hmmer`, `samtools`, `seqkit` and `skewer` each get
a stage near the top of the `Dockerfile`, installing to
`/tools/<tool>/<version>/`, and the workflow runtime stages copy out of
them. They were `ghcr.io/virtool/tools`, a separate repo; the recipes
here are that repo's `install_*.sh` scripts verbatim, down to the
upstream URLs and the layout.

**`pigz` is the one tool without a stage.** The only source for its
tarball is zlib.net, which has gone down and taken every queued build
with it — the stage never fails, it hangs, and the runner's six-hour
ceiling is what ends the job. The pathoscope runtime stage installs
Debian's `pigz` package instead. Nothing in this repo depends on its
exact output bytes: `@virtool/workflow`'s gzip helpers are `node:zlib`
in-process and checksums are taken over decompressed content, so
bookworm's 2.6 stands in for 2.8 unnoticed. Don't restore the stage.

Every `wget` in the block passes `--tries=3 --timeout=30`. wget defaults
to 20 tries at a 900-second read timeout, which is what turned one
unreachable mirror into a job that hung rather than failed; these are
academic and personal servers, and they do go down.

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

### The four workflow images

The workflow images are in two states, and the split is deliberate. Which
one an image is in turns on a single question: does a Python repo still
release that workflow?

| Image | Built | Published | Blocked on |
| --- | --- | --- | --- |
| `ts-create-sample` | ✅ | ✅ | — |
| `ts-create-subtraction` | ✅ | ✅ | — |
| `ts-pathoscope` | ✅ | ❌ | `virtool/workflow-pathoscope` retiring |
| `ts-nuvs` | ✅ | ❌ | `virtool/workflow-nuvs` retiring |

`virtool/workflow-create-sample` and `virtool/workflow-create-subtraction`
are still live too, but they publish `ghcr.io/virtool/create-sample` and
`ghcr.io/virtool/create-subtraction` — different names from the `ts-`
images here, so the cluster picks one by the image it pulls and there is
no ambiguity to resolve. The same is true of the two unpublished images
and would be true if they published tomorrow; what stops them is not a
name collision but that **two pipelines shipping the same workflow leaves
two candidates for what the cluster runs**, and that has to be settled
deliberately rather than by whichever released last.

**Pathoscope and nuvs are the odd two, and both are built but
deliberately not published.** Each has its own build job
(`build-pathoscope`, `build-nuvs`) with no publish counterpart. Restore a
publish job for one when its Python repo retires, and settle which image
name the cluster pulls in the same change. Note that `release-ghcr` is
also what stamps a real version, so until then `APP_VERSION` is `0.0.0`
in every built pathoscope or nuvs image, and the `workflow_version` in
their cache keys with it.

**`ghcr.io/virtool/ts-pathoscope` already exists in the registry, and
nothing here produced it.** A `publish-pathoscope` job lived in `ci.yaml`
briefly and was removed once the two-pipeline problem was recognised; it
left three versions behind, `:latest` among them. They predate the
workflow port, so that tag is a tools-only image with no workflow code in
it — a pull of `ts-pathoscope:latest` gets something that cannot run a
job. Do not treat those tags as evidence the image is published, and do
not read `:latest` as current.

Both build jobs, plus `pathoscope-test` and `quality-test`, are the only
path-filtered jobs in `ci.yaml`, and they take a filter each because
their inputs differ: the two crate jobs run cargo and read no TypeScript,
while `build-pathoscope` and `build-nuvs` bundle their app on the shared
`base` and so take every workspace package their build stage copies.
`pathoscope-test` also carries `Dockerfile`, because it builds the
`bowtie2` target to get the binary its golden vectors shell out to.

**Everything a build stage `COPY`s must appear under that image's
filter** — a missing path skips the build on the pull request that breaks
it and fails on the push to `main`, where nothing gates it. That includes
everything `base` copies, packages the app does not import among them:
`base` is shared, so it copies `packages/data`, `packages/service` and
`packages/bio` whichever target was requested. The two image filters are
therefore nearly identical, and are kept separate rather than merged
because pathoscope copies `packages/pathoscope-core` and nuvs does not —
folding them into one would rebuild each image for the other's inputs.

Build a single image locally by naming its target:

```
docker build --target pathoscope .
```
