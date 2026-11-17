# @virtool/create-sample

Image: `ghcr.io/virtool/create-sample`.

Turns a user's uploaded FASTQ files into a sample that an analysis can run
against. It normalizes the uploads to `reads_1.fq.gz` and `reads_2.fq.gz`,
measures their quality, and commits them to object storage. Uploads can be
plain, gzip, or bzip2.

The image needs three external binaries: `lbzip2`, `pigz`, and
[`quality-core`](../../packages/quality-core/README.md). `quality-core` is a
Rust crate in this repository.

## Building the image

```console
docker buildx bake -f packages/image-build/docker-bake.hcl create-sample
```

## Configuration

This app uses the shared `@virtool/workflow` runtime configuration. See the
[workflow package README](../../packages/workflow/README.md#configuration) for
the environment variables and configuration rules.

## Commands

Run from the monorepo root.

| Command                                          | Action                     |
| ------------------------------------------------ | -------------------------- |
| `pnpm --filter @virtool/create-sample build`     | Bundle to `dist/index.mjs` |
| `pnpm --filter @virtool/create-sample start`     | Run the bundle             |
| `pnpm --filter @virtool/create-sample test`      | Vitest                     |
| `pnpm --filter @virtool/create-sample typecheck` | `tsc --noEmit`             |
