# Non-Vite Node apps

Most of this repo is Vite: `apps/web` is a TanStack Start SPA that Nitro
builds into `.output/server/index.mjs`, and `apps/site` is Astro on
Cloudflare Workers. The rest are plain Node processes — the jobs control
plane and the workflow executors — and this document covers how they are
built, linted, typechecked, containerised, and how to add another one.

## Apps bundle, packages stay source

The workspace packages under `packages/` are **unbuilt TypeScript**.
They have no `build` script, no `dist`, and `packages/tsconfig.base.json`
sets `noEmit: true`; their `exports` maps point straight at
`./src/*.ts`. Nothing resolves them through a compiled artifact, which is
what lets a change to `@virtool/data` be visible to every consumer with
no build step in between.

A plain `node` process cannot import a `.ts` file, so the apps are where
the compilation happens: **each non-Vite app bundles to a single
`dist/index.mjs` with every `@virtool/*` package inlined from source.**

Do not "fix" the asymmetry by giving the packages a `dist` build. The
apps bundling is not a workaround for the packages being unbuilt — it is
the design. A package that emitted `dist` would have to be rebuilt before
any consumer saw a change, and the type-declaration trap that
`apps/web/src/server` lives with (`TS2883`, no `.d.ts`, every
`@server/*` import breaking at once) would spread to every package.

## The bundler is tsdown

`tsdown` is Rolldown-backed and declares itself the successor to tsup,
whose own README declares that project unmaintained. Rolldown was already
in this repo's dependency graph through `@rolldown/plugin-babel`, so it
adds no new toolchain family.

The deciding argument was knip. **knip ships a `tsdown` plugin**, and it
reads two things out of `tsdown.config.ts`:

- `entry` becomes the workspace's production entry points, so knip finds
  the app's source without a `knip.json` block; and
- every **string** in `deps.neverBundle` counts as a used dependency, so
  a package that appears in the app's manifest only because the bundle
  imports it at top level is not reported as unused.

Between them, an app needs no entry in `knip.json` at all. Raw Rolldown
and esbuild have knip plugins too, but neither gives you the second half.

Externals must therefore be written as **string literals** in
`deps.neverBundle`. A regular expression there is invisible to knip and
its packages come back as unused dependencies.

## What is bundled and what is external

tsdown externalises everything in `dependencies` and `peerDependencies`
by default. Two overrides shape that into what these apps need:

```ts
deps: {
    alwaysBundle: [/^@virtool\//],
    neverBundle: ["pino", "postgres"],
},
```

- **`alwaysBundle: [/^@virtool\//]`** — workspace packages are declared as
  `dependencies`, so without this they would stay external and the output
  would carry an `import "@virtool/data/db/pg"` that resolves to a `.ts`
  file `node` cannot load.
- **`neverBundle`** — native addons and anything with a worker-thread or
  dynamic-path runtime. `bcrypt` is a native addon and cannot be bundled
  at all. `pino` resolves transport worker files by path at runtime.
  `postgres`, `@aws-sdk/*` and `@azure/*` are heavyweight and gain
  nothing from inlining.

Everything a bundled workspace package pulls in that is *not* on that
list gets inlined — `drizzle-orm` and `es-toolkit`, for instance. That is
deliberate: it keeps the deployed `node_modules` to the handful of
packages that genuinely have to be real files on disk.

An app's `package.json` must therefore declare every external directly,
even when the import comes from inside a workspace package. Bundling
flattens the module graph, so `import postgres from "postgres"` ends up at
the *top level* of the app's `dist/index.mjs` and resolves from the app's
own `node_modules`, not `@virtool/data`'s.

## Deploying the externals into an image

Bundling handles the workspace TypeScript; the externals still have to be
real files. `pnpm deploy --filter <app> --prod <out>` builds that tree,
and `injectWorkspacePackages: true` in `pnpm-workspace.yaml` is what
allows it — without the setting `pnpm deploy` refuses to materialise a
`workspace:*` dependency and the deployed tree is broken.

The setting is scoped in practice to `pnpm deploy`. A normal
`pnpm install` still symlinks workspace packages into
`apps/*/node_modules/@virtool/*`, because `dedupeInjectedDeps` defaults on
and dedupes an injected dependency back to a symlink when no peer
mismatch forces otherwise. Editing a package's source is still picked up
with no re-install.

Each app sets `"files": ["dist"]` so `pnpm deploy` packs the bundle
alongside the manifest and `node_modules`. Without it the deployed tree
has the dependencies and none of the code.

If an app's externals list is ever empty, the deploy step can be skipped
for that image — but every app has one today.

## Layout of an app

```
apps/<name>/
  package.json      # @virtool/<name>, private, type: module, files: ["dist"]
                    # scripts: build (tsdown), start, typecheck
  tsconfig.json     # extends ../tsconfig.node.json
  tsdown.config.ts  # entry, externals
  src/index.ts      # the bundler entry
```

`apps/tsconfig.node.json` is the shared base: Node-only, `types:
["node"]`, no DOM lib and no JSX. It deliberately does **not** extend
`apps/web/tsconfig.json`, which carries the browser path aliases and a
DOM lib.

Its `moduleResolution: "Bundler"` is load-bearing. It is what lets
`@virtool/storage` resolve through the package's `exports` map straight
into `packages/storage/src/*.ts`; a `"node16"` resolution will not follow
an exports map to a `.ts` file.

Adding a directory in that shape is enough to be covered by `pnpm build`,
`pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm knip`, with no
edits to root scripts, `knip.json`, `biome.json`, the Dockerfile install
layer, or `pnpm-workspace.yaml`. Adding a new *image* still needs a
Dockerfile stage and a CI matrix entry — the one deliberate exception.

## The apps

- **`apps/jobs-api`** — `@virtool/jobs-api`, the jobs API: the control
  plane workflow runners call to claim, run and finish jobs. It is called
  "the jobs API" everywhere — directory, package, image, Kubernetes
  service and prose — matching Python and the workflow runtime; "control
  plane" is its role, not an alternate name. A long-running **Hono** app
  on `@hono/node-server`, port 9950, mirroring Python's
  `virtool/jobs/main.py`, which serves as `api-jobs-service` behind a
  ClusterIP with no ingress rule. Hono because the handlers it will grow
  are ported from raw-route handlers already written against Web
  `Request`/`Response`, so they move across verbatim. Serves
  `/health/live`, `/health/ready` and a token-gated `/metrics`; the
  readiness probe folds `checkPostgres` through `summarizeReadiness`, the
  same pair `apps/web` uses. `postgres` and `pino` are its externals.
  Image: `ghcr.io/virtool/jobs-api`.
- **`apps/create-subtraction`** — `@virtool/create-subtraction`, the first
  workflow executor. One-shot: the pod starts, does its work, exits. Only
  its object-storage half is wired; claiming a job arrives with the
  workflow runtime core. Image: `ghcr.io/virtool/ts-create-subtraction`.

The remaining three workflow executors get their directory, Dockerfile
stage and matrix entry when their port lands.

### `create_subtraction` is ported without `build_index`

Python's workflow has four steps — decompress the source FASTA, compute
`gc` and `count`, build a bowtie2 index, then compress the FASTA, upload
it alongside `bowtie_index_path.glob("*.bt2")` and finalize. **The port
drops the third step and that glob**, and the decision is settled rather
than pending.

Nothing consumes the shards. Both analysis workflows build a
subtraction's bowtie2 index locally from the `.fa.gz` and memoize it
through their own workflow cache, and `WFSubtraction.bowtie2_index_path`
is defined and never read — so the shards are written by one workflow
and read by none. The jobs API's `PATCH /subtractions/{id}` whitelists
`subtraction.fa.gz` and nothing else, so a manifest carrying a shard is
refused: a port that kept the step could not finalize.

What is left runs **no external process**. `decompressFile`,
`compressFile` and `isGzipped` in `@virtool/workflow`'s `files/`
deliberately do not shell out to `pigz` — they are `node:zlib` streams,
because Python's `pigz` branch exists for parallelism and checksums are
taken over decompressed content, so the gzip bytes need not match. The
`gc`/`count` step is a scan over the decompressed FASTA. Transfers are
`downloadToPath` / `uploadFromPath` against the storage backend.

That is the whole reason this image is Alpine rather than Debian, and it
is the chain to re-check before reintroducing a step: a workflow that
runs a tool binary needs the glibc base back.

## Images

Both kinds of app get a build stage and a runtime stage in the root
`Dockerfile`. The build stages share `base`, which installs once from
every workspace manifest.

**The install layer takes manifests by glob.** `COPY --parents
apps/*/package.json packages/*/package.json ./` preserves directory
structure — a plain `COPY apps/*/package.json apps/` flattens them all
onto one path. That needs the `# syntax=docker/dockerfile:1-labs` parser
directive on the first line of the file. Adding a workspace must not mean
editing a list of `COPY` lines.

**Package *source*, though, is copied one `COPY` per package.** The glob
above matches manifests only, so it skips `packages/pathoscope-core`,
which is a Rust crate with no `package.json`. A blanket
`COPY packages ./packages` would pull that crate's `src/` and
`Cargo.lock` into the layer and bust its cache on every Rust edit, for a
tree no TypeScript image has any use for. Add a line when a new
TypeScript package appears.

**App source is copied per build stage, not in `base`.** A change to
`apps/web` then does not invalidate the jobs-api image's cache, and the
install layer stays untouched when an app is added.

**The runtime base is decided by one question: does the app run a
binary from `ghcr.io/virtool/tools`?**

- **No** — `node:24-alpine`. `apps/jobs-api`, `apps/tasks` and
  `apps/create-subtraction` all copy nothing from the tools image, so
  none of them pays Debian's size. Do not move one to Debian for
  uniformity with a workflow image.
- **Yes** — `node:24-bookworm-slim`. Those binaries are built against
  `python:3.13-bookworm` and dynamically linked against glibc; Alpine is
  musl and could not load them. `apps/pathoscope`, which has its
  own Dockerfile, is the worked example. Do not move a tools-carrying
  image to Alpine for uniformity either.

Being a workflow does not by itself answer the question — a workflow
whose steps are all in-process belongs on Alpine. Adding a
`COPY --from=ghcr.io/virtool/tools` line to an Alpine stage means moving
that stage to Debian in the same edit.

**Not every tool in that image is a binary,** so a Debian stage usually
installs interpreters too. `bowtie2-build` is a python3 script that picks
between the real `bowtie2-build-s` and `bowtie2-build-l` by index size;
`bowtie2` is a perl one. Neither package can be trimmed:
`python3-minimal` omits the stdlib and `bowtie2-build` dies on
`import gzip`, and a slim base's `perl-base` omits `Sys::Hostname`, which
`bowtie2` needs. The alternative — calling the `-s`/`-l` binaries
directly and porting bowtie2's own size heuristic — belongs with a
workflow, not with the base image every workflow shares.

Check a new tool's entry point rather than assuming it is an ELF:
`docker run --rm --entrypoint sh <image> -c 'head -1 /tools/<tool>/...'`.

Every build stage runs on the Alpine `base`, including one whose runtime
stage is Debian, which is safe only because the deployed tree carries no
native addon. Check
`find /prod/<app> -name '*.node'` before adding a dependency that might.
(`bcrypt`, which reaches `apps/jobs-api` through `@virtool/data`, ships
prebuilds for both libc flavours, so it is not a counterexample.)

## Repo-wide gates

- **`pnpm build`** is `pnpm -r --filter "./apps/*" --filter
  "!@virtool/site" build`. Every app but the site, which is deliberately
  excluded from the repo-wide gates and covered by its own `site-build`
  CI job.
- **`pnpm check` / `pnpm format`** run biome over `apps packages` rather
  than a literal `apps/web/src`. `apps/site` is excluded once, in
  `biome.json`'s `files.includes`, because Astro is not linted by biome.
- **`pnpm typecheck` and `pnpm test`** were already `pnpm -r`; an app is
  picked up as soon as it declares the script.
- **CI's `packages-test`** filters by exclusion (`!@virtool/web`,
  `!@virtool/data`, `!@virtool/storage` — the three with their own jobs)
  rather than by an inclusion list, so a new workspace that declares
  `test` is covered without editing the job.

## No app may import from `apps/web`

A `biome.json` override scoped to `apps/*/src/**` minus `apps/web/src/**`
bans every browser feature alias, `@server/**`, the `@/*` catch-all, and
any specifier reaching `apps/web` relatively. `apps/jobs-api` is the
likeliest offender: it does work `apps/web/src/server` also does, so
copying an import from there is an easy mistake, and the aliases would
not even resolve.

The arrow runs down into the packages instead. Shapes both sides need
live in `@virtool/contracts`; the data and storage layers live in
`@virtool/data` and `@virtool/storage`, which is exactly why they were
extracted.
