# pathoscope-core

Pathoscope's expectation-maximization core, built as a standalone
command-line binary that
[`@virtool/pathoscope`](../../apps/pathoscope/README.md) invokes as a
subprocess.

One of two Rust crates here; the other is
[`quality-core`](../quality-core/README.md). Neither is a pnpm workspace
member, so `pnpm test` does not reach them.

## Results are byte-identical to the Python build, and pinned that way

`tests/golden/vectors.json` holds 17 vectors captured from the PyO3 build
*before* the crate moved, covering all three entry points.
`tests/golden_vectors.rs` runs the binary over each and asserts the output
matches exactly.

Floats are compared with `f64::to_bits()` — not a tolerance, and not as text.
"Equivalent within tolerance" is not the bar for a diagnostic workflow, and
comparing rendered text would fail on a harmless difference between Python's
and Rust's float formatters while saying nothing about the values. The harness
catches a one-ULP drift.

Coverage arrays are stored sparsely (a length plus the non-zero positions).
They are sized to the reference, so a vector over a 50 kb reference is 50,000
entries of which ~200 are non-zero; dense storage made the corpus 1.3 MB, 98%
of it zeros. The encoding is lossless — the harness rebuilds the dense array.

`tests/golden/generate.py` is the provenance record for the corpus. It is not
run by CI and cannot be re-run from this repo alone: it imports the Python
extension module from `workflow-pathoscope`. If a vector ever needs
regenerating, regenerate it from that build, never from this one — a corpus
generated from the code under test asserts nothing.

## Five modules are frozen

`em.rs`, `matrix.rs`, `sam.rs`, `subtraction.rs` and `coverage.rs` — 2,511
lines — came across with no change but their test fixture paths. A diff showing
a change inside `em()` is a failed port, not an improvement.

`coverage.rs` carries a TODO at the top flagging an unresolved question about
whether the score calculation should include all alignments above the threshold
or only the best assignment per read. **Leave it there.** The golden vectors now
pin the current behaviour, including that behaviour, so the question can be
answered against a baseline later instead of guessed at. VIR-2913 tracks it.

`candidates.rs` is the one module that changed: the `pyo3` imports, the
`py: Python` parameter, the `PyResult` return and the `py.allow_threads`
wrapper are gone, and it returns `PathoscopeError` instead.

## The CLI contract

One binary, three subcommands, no shared state between invocations.

| Subcommand | Flags |
| --- | --- |
| `em` | `--alignment`, `--p-score-cutoff`, `--output` |
| `candidates` | `--index`, `--reads` (repeatable), `--proc`, `--p-score-cutoff`, `--output` |
| `eliminate-subtraction` | `--isolate-alignments`, `--subtraction-alignments`, `--output-alignments`, `--input-fastq`, `--output-fastq`, `--proc`, `--output` |

The alignment flags are deliberately **format-neutral**. They were renamed from
`--isolate-sam` / `--subtraction-sam` / `--output-sam`, inherited from the PyO3
parameter names, because the workflow passes BAM at every one of those
positions. `rust-htslib` reads and writes both, so the old names were merely
wrong at every call site forever, and invited someone to "fix" them by
converting a file that never needed converting.

`--output` always means the JSON results file, in all three subcommands.
`--output-alignments` and `--output-fastq` are data files at paths the caller
names. The near-collision is deliberate: one flag means "where the result
summary goes", everywhere.

Other contracts:

- **Results go to files, never stdout.** stdout carries nothing at all, so a
  stray `println!` cannot corrupt a result. The golden harness asserts stdout is
  empty for every invocation.
- **Diagnostics go to stderr as JSON lines** — `{"level","target","msg"}`. The
  parent's logger (`@virtool/logger`, a pino wrapper) reads JSON. Level comes
  from `--log-level` or `RUST_LOG`, which wins when set. The old `logging.rs`
  forwarded records to Python's logging module over the GIL; there is no
  interpreter on the other side any more, so it was deleted rather than ported.
- **Exit 0 on success, non-zero on failure** with a human-readable message on
  stderr. The Node side treats any non-zero exit as a workflow failure and does
  not parse stderr for control flow.
- **`proc` is `u32`** and rejected at parse time if below 1, rather than being
  taken as `i32` and clamped with `proc.max(1)`.

## Commands

Run from this directory — the crate is not a pnpm workspace, so `pnpm test`
and `pnpm typecheck` do not reach it.

| Command | Action |
| --- | --- |
| `cargo test` | Run the suite, golden vectors included |
| `cargo fmt` | Format (`rustfmt.toml`, `max_width = 88`) |
| `cargo clippy` | Lint — advisory only, see below |

Building needs `libclang-dev` installed, because `hts-sys` runs bindgen against
htslib's headers.

## Rust is formatted but not clippy-gated

This is a recorded decision, not an oversight.

`cargo fmt --check` runs in CI. The code already satisfied it.

`cargo clippy -- -D warnings` is **not** a gate. The five frozen modules are
2,511 lines of inherited code that would need edits inside them to satisfy it —
`sam.rs` alone carries two unused imports that the build warns about today — and
those edits are exactly what the byte-identical port forbids. Revisit once the
code has been through a round of ownership here. Until then, clippy is
advisory: run it, don't gate on it.

## Tooling exclusions

The crate has no `package.json`, so it is not a pnpm workspace, and `pnpm test`
and `pnpm typecheck` do not reach it. Two exclusions are still needed and must
stay:

- **biome** — `!packages/pathoscope-core` in `biome.json`'s `files.includes`.
  Biome ignores `.rs`, `.toml` and the fixtures, but it does parse
  `tests/golden/vectors.json` and wants to reformat it. That file is machine
  generated; formatting it would only make the next regeneration fail the gate.
- **knip** — `packages/pathoscope-core/**` in `knip.json`'s `ignore`. `hts-sys`
  vendors htslib's C source into `target/`, and that tree carries a
  `htscodecs/javascript/` directory which knip reports as unused files after any
  local `cargo build`. knip itself emits a configuration hint asking for this
  ignore to be removed, because in a checkout where the crate has never been
  built `target/` does not exist and the pattern matches nothing. Do not act on
  that hint: it is right about the clean checkout and wrong about every machine
  that has run `cargo build`.

The root `Dockerfile` copies `packages/` **per package**, not as a blanket
`COPY packages ./packages`. The UI image has no use for the crate, and a blanket
copy would pull its `src/` and `Cargo.lock` in and bust that layer's cache on
every Rust edit. Add a line there when a new TypeScript package appears.
`**/target` is in `.dockerignore` for the same reason, from the other side.

## The image build

The root `Dockerfile`'s `pathoscope` target builds
`ghcr.io/virtool/ts-pathoscope`. The crate is compiled in the same Dockerfile as
its only consumer, so there is no second release stream to coordinate and no
window in which the workflow and its core disagree.

The `Pathoscope / Build` job compiles the Dockerfile on every run and
`release-ghcr` pushes it on release. `virtool/workflow-pathoscope` still
releases the pathoscope workflow too, but it publishes
`ghcr.io/virtool/pathoscope` while this Dockerfile targets
`ghcr.io/virtool/ts-pathoscope` — the cluster picks one by the image it pulls,
and neither stream overwrites the other.

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
against htslib's headers for `x86_64-unknown-linux-gnu` and does not fall back
to the pre-generated bindings that ship for some targets. Dropping the package
fails the build with `Unable to find libclang`. This was verified empirically,
and the same requirement applies to the `pathoscope-test` CI job and to any
developer machine.

The runtime stage installs `libcurl4`, `libgomp1`, `libncursesw6` and `perl`.
Each backs a specific `ldd ... => not found` against the slim base: perl and
libgomp1 for bowtie2, libcurl4 and libncursesw6 for samtools. `pathoscope-core`
itself needs none of them — `hts-sys` links htslib statically.

The `build-pathoscope` CI job sets `cache-from: type=gha` and
`cache-to: type=gha,mode=max` under a `pathoscope` scope. There is no publish
counterpart yet; when one is restored it needs the same pair, because dropping
it means the release path rebuilds htslib from scratch every time, which is the
trap the old repo fell into.

**A job that exports a cache must run `docker/setup-buildx-action` first.** The
runner's default builder uses the `docker` driver, which cannot export a build
cache at all — `cache-to` fails the build outright with "Cache export is not
supported for the docker driver" rather than degrading to an uncached build.
The action swaps in a `docker-container` builder that can. This applies to
every job here that sets `cache-to`, the UI image's `build` and `release-ghcr`
included.
