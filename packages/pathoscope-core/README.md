# pathoscope-core

Pathoscope's expectation-maximization core, built as a standalone
command-line binary that
[`@virtool/pathoscope`](../../apps/pathoscope/README.md) runs as a
subprocess.

One of two Rust crates here. The other is
[`quality-core`](../quality-core/README.md). Neither crate is a pnpm workspace
member, so `pnpm test` and `pnpm typecheck` do not run them.

The binary has three subcommands: `em`, `candidates`, and
`eliminate-subtraction`. It writes results to the file named by `--output`,
never to stdout. Diagnostics go to stderr as JSON lines. Set the level with
`--log-level` or `RUST_LOG`. `RUST_LOG` wins when set. Exit code 0 means
success.

Results must match the golden corpus bit for bit. Never edit the corpus to make
a test pass.

## Commands

Run from this directory.

| Command | Action |
| --- | --- |
| `cargo test` | Run the suite, golden vectors included |
| `cargo fmt` | Format |
| `cargo clippy` | Lint |

Building needs `libclang-dev`. Without `bowtie2` and `bowtie2-build` on `PATH`,
`cargo test` skips the `candidates` golden vectors with a warning.

To run the checks as CI does, from the repository root:

```bash
docker buildx bake -f packages/image-build/docker-bake.hcl pathoscope-core-test --progress=plain
```

This runs `cargo fmt --check` and `cargo test` with the image's toolchain and
bowtie2 build. A missing bowtie2 fails the run. BuildKit caches the result, so
a second run with unchanged inputs does not run the tests again.

## Tooling exclusions

Biome and knip skip this crate. Do not reformat the golden corpus: Biome would
rewrite every line without changing a value. After a local `cargo build`, knip
reports the C source that `hts-sys` vendors into `target/`. Knip may hint that
its ignore pattern matches nothing. That hint is true only in a checkout that
has never built the crate. Do not act on it.

## The image

The `pathoscope` Bake target builds `ghcr.io/virtool/pathoscope`. The crate and
the app form one release stream. See [Images](../../README.md#images) for the
shared image build and release pipeline.
