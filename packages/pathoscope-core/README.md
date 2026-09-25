# pathoscope-core

Pathoscope's expectation-maximization core, built as a standalone
command-line binary that
[`@virtool/pathoscope`](../../apps/pathoscope/README.md) invokes as a
subprocess.

One of two Rust crates here; the other is
[`quality-core`](../quality-core/README.md). Neither is a pnpm workspace
member, so `pnpm test` doesn't reach them.

## Results are byte-identical to the golden corpus, and pinned that way

`tests/golden/vectors.json` holds 17 vectors covering all three entry points.
`tests/golden_vectors.rs` runs the binary over each and asserts the output
matches exactly. The corpus is a frozen reference: **never edit a vector to
make a failing comparison pass.**

Floats are compared using `f64::to_bits()`. The comparison doesn't use a
tolerance or rendered text.
"Equal within tolerance" isn't the bar for a diagnostic workflow, and
comparing rendered text would fail on a harmless difference between float
formatters while saying nothing about the values. The harness catches a one-ULP
drift.

Coverage arrays are stored sparsely (a length plus the non-zero positions).
They're sized to the reference, so a vector over a 50 kb reference is 50,000
entries of which ~200 are non-zero; dense storage made the corpus 1.3 MB, 98%
of it zeros. The encoding is lossless. The harness rebuilds the dense array.

## The command-line tool contract

One binary, three subcommands, no shared state between invocations.

| Subcommand | Flags |
| --- | --- |
| `em` | `--alignment`, `--p-score-cutoff`, `--output` |
| `candidates` | `--index`, `--reads` (repeatable), `--proc`, `--p-score-cutoff`, `--output` |
| `eliminate-subtraction` | `--isolate-alignments`, `--subtraction-alignments`, `--output-alignments`, `--input-fastq`, `--output-fastq`, `--proc`, `--output` |

The alignment flags are deliberately **format-neutral**, and not
`--isolate-sam` / `--subtraction-sam` / `--output-sam`: the workflow passes BAM
at every one of those positions. `rust-htslib` reads and writes both, so a
`--*-sam` name would be wrong at every call site forever, and would invite
someone to "fix" it by converting a file that never needed converting.

`--output` always means the JSON results file, in all three subcommands.
`--output-alignments` and `--output-fastq` are data files at paths the caller
names. The near-collision is deliberate: one flag means "where the result
summary goes," everywhere.

Other contracts:

- **Results go to files, never stdout.** stdout carries nothing at all, so a
  stray `println!` can't corrupt a result. The golden harness asserts stdout is
  empty for every invocation.
- **Diagnostics go to stderr as JSON lines**: `{"level","target","msg"}`. The
  parent's logger (`@virtool/logger`, a pino wrapper) reads JSON. Level comes
  from `--log-level` or `RUST_LOG`, which wins when set.
- **Exit 0 on success, non-zero on failure** with a human-readable message on
  stderr. The Node side treats any non-zero exit as a workflow failure and does
  not parse stderr for control flow.
- **`proc` is `u32`** and rejected at parse time if below 1, rather than being
  taken as `i32` and clamped with `proc.max(1)`.

## Commands

Run from this directory. The crate isn't a pnpm workspace, so `pnpm test`
and `pnpm typecheck` don't reach it.

| Command | Action |
| --- | --- |
| `cargo test` | Run the suite, golden vectors included |
| `cargo fmt` | Format (`rustfmt.toml`, `max_width = 88`) |
| `cargo clippy` | Lint |

Building needs `libclang-dev` installed, because `hts-sys` runs bindgen against
htslib's headers.

## Tooling exclusions

The crate has no `package.json`, so it's not a pnpm workspace, and `pnpm test`
and `pnpm typecheck` don't reach it. Two exclusions are still needed and must
stay:

- **biome**: `!packages/pathoscope-core` in `biome.json`'s `files.includes`.
  Biome ignores `.rs`, `.toml` and the fixtures, but it does parse
  `tests/golden/vectors.json` and wants to reformat it. Keep the corpus as
  committed; reformatting it rewrites every line without changing a value.
- **knip**: `packages/pathoscope-core/**` in `knip.json`'s `ignore`. `hts-sys`
  vendors htslib's C source into `target/`, and that tree carries a
  `htscodecs/javascript/` directory which knip reports as unused files after any
  local `cargo build`. knip itself emits a configuration hint asking for this
  ignore to be removed, because in a checkout where the crate has never been
  built `target/` doesn't exist and the pattern matches nothing. Don't act on
  that hint: it's right about the clean checkout and wrong about every machine
  that has run `cargo build`.

The root `Dockerfile` copies `packages/` **per package**, not as a blanket
`COPY packages ./packages`. The UI image has no use for the crate, and a blanket
copy would pull its `src/` and `Cargo.lock` in and bust that layer's cache on
every Rust edit. Add a line there when a new TypeScript package appears.
`**/target` is in `.dockerignore` for the same reason, from the other side.

## The image build

The root `Dockerfile`'s `pathoscope` target builds
`ghcr.io/virtool/pathoscope`. The crate is compiled in the same Dockerfile as
its only consumer, so there is no second release stream to coordinate and no
window in which the workflow and its core disagree.

The `Pathoscope / Build` job compiles the Dockerfile on every run and
`release-ghcr` pushes it on release.

**The crate is built on `rust:1.97-bookworm`.** The runtime copies binaries from
the tool stages in the same file, which are built on `debian:bookworm`, so the
Rust core has to be an ordinary glibc build and `rust-htslib`'s unverified musl
support never arises. Every other stage in that file is Debian too, so nothing
here is a special case any more.

The build is cargo-chef layered: dependencies are cooked in their own layer
before `src` is copied. `hts-sys` vendors htslib's C source and compiles it with
the `cc` crate, which is by far the most expensive step and changes essentially
never. Without the split, every source edit recompiles htslib. Verify the split
still holds by editing a `.rs` file and confirming the `cargo chef cook` layer
reports `CACHED`.

**`libclang-dev` is required, not optional.** `hts-sys` 2.2.x runs bindgen 0.69
against htslib's headers for `x86_64-unknown-linux-gnu` and doesn't fall back
to the pre-generated bindings that ship for some targets. Without the package,
the build fails with `Unable to find libclang`. The requirement also applies to
the `pathoscope-test` CI job and developer machines.

The runtime stage installs `libcurl4`, `libgomp1`, `libncursesw6` and `perl`.
Each backs a specific `ldd ... => not found` against the slim base: perl and
libgomp1 for bowtie2, libcurl4, and libncursesw6 for samtools. `pathoscope-core`
itself needs none of them. `hts-sys` links htslib statically.

The `build-pathoscope` CI job and its release entry use the same `pathoscope`
GitHub Actions cache scope. See
[Continuous integration](../../docs/ci.md#images) for the shared image build
and release pipeline.

**A job that exports a cache must run `docker/setup-buildx-action` first.** The
runner's default builder uses the `docker` driver, which can't export a build
cache at all. `cache-to` fails the build outright with "Cache export isn't
supported for the docker driver" rather than degrading to an uncached build.
The action swaps in a `docker-container` builder that can. This applies to
every job here that sets `cache-to`, the UI image's `build` and `release-ghcr`
included.
