# Bundling

**The chunk is the unit of loading, not the export.** Every rule here follows
from that one fact. It does not matter that you imported a single symbol, and
it does not matter that the module is side-effect-free: if a chunk is reachable
from something loaded eagerly, the whole chunk is downloaded.

Tree-shaking removes unused *code within a chunk*. It does not decide which
chunks a page fetches.

## The eager half of a route

`autoCodeSplitting`, set on the `tanstackStart` plugin in
`apps/web/vite.config.js`, splits every route file in two.

The **critical** half is `loader`, `beforeLoad`, `validateSearch`, and
`loaderDeps`. `routeTree.gen.ts` imports it *statically*, and that file is the
router's entry — so whatever the critical half reaches lands in the eager
bundle that **every** page load pays for, including `/login`.

Only the `component` half is lazy. An import that is ruinous in a loader is
free in a component.

### Never statically import a feature's `queries.ts`

A feature's `queries.ts` carries its whole request layer: every server-function
stub, and the zod schemas those stubs validate against. Pulling in one
`queryOptions` factory brings all of it.

Pull the factory in from inside the loader body instead, where the import is
deferred to the point the loader actually runs:

```ts
export const Route = createFileRoute("/samples/$sampleId")({
	loader: async ({ context, params }) => {
		const { sampleQueryOptions } = await import("@samples/queries");
		await context.queryClient.ensureQueryData(sampleQueryOptions(params.sampleId));
	},
});
```

Importing the same module at the top of the `component` half is fine.

### Never use zod in `validateSearch`

`validateSearch` is synchronous. There is no point at which a dynamic import
can be awaited, so a zod schema there pins all ~108 KB of zod into the eager
bundle with no way to defer it.

Use the dependency-free coercion helpers in `@app/searchParams`, and type the
function so partial navigation still type-checks:

```ts
validateSearch: (input: Partial<FooSearch> & SearchSchemaInput): FooSearch => ({
	term: str(input.term, ""),
	...paginated(input),
}),
```

The `SearchSchemaInput` tag is what keeps `<Link search={{ page: 2 }}>` legal
without spelling out every other param.

## What a route guard reaches is downloaded on the login wall

A `beforeLoad` that resolves an account, and any loader on `/login` or
`/setup`, runs for visitors with no session. Everything those reach is fetched
before a user can sign in — **including modules reached through a dynamic
`import()`**, because the deferral changes *when* the chunk loads, not whether
an unauthenticated visitor is the one loading it.

This is where "the chunk is the unit of loading" bites hardest. Importing a
feature's `queries.ts` for one factory pulls that module's entire chunk onto
the login wall: every other request it defines, and every zod schema they
carry. Declaring the package side-effect-free does nothing.

So the `queryOptions` the guards need live in their own modules, apart from
their feature's `queries.ts`, each importing exactly one server function and
nothing else:

| Module | Exports | Backed by |
| --- | --- | --- |
| `@account/account` | `accountQueryOptions`, `useFetchAccount` | `getAccount` |
| `@administration/passwordPolicy` | `passwordPolicyQueryOptions` | `getPasswordPolicyFn` |
| `@nav/queries` | `rootQueryOptions`, `useRootQuery` | `getRoot` |

The `@nav/queries` guard reads `firstUser` from the root query before any
session exists, which is why it cannot wait until after authentication.

Keep these out of their feature's `queries.ts` even when that module looks
light today. The rule is not "this module is currently small" — it is that
nothing stops the next request added there from riding along onto the login
wall unnoticed.

## Heavy dependencies get their own module

A module's imports survive tree-shaking when the package does not declare
`sideEffects: false`. A grab-bag utility module therefore leaks its heaviest
dependency into every bundle that wants *any* of its exports.

`cn()` lives in `@app/cn` rather than `@app/utils` for exactly this reason: it
keeps `tailwind-merge` out of every bundle that only wanted a plain string
helper. Don't merge it back, and split the next utility that acquires a heavy
dependency the same way.

## Server modules reached from the browser program

`src/server/**` is reachable from the browser program through `start.ts`, which
`routeTree.gen.ts` pulls in. A top-level import of a server-function module
from anything on that path drags the server graph — and whatever it depends on,
from `prom-client` to `node:*` reads — into the client bundle.

Reach those modules through `createServerOnlyFn` and a dynamic import instead.
`auth/middleware.ts` is the worked example, and `metricsMiddleware` is the
other: it loads the metrics registry that way so prom-client never enters the
client graph.

## A native dependency must never be bundled

A package that loads a `.node` addon locates it relative to `__dirname`, which
has no value in an ES module. Bundling one produces a server that builds
cleanly and throws `ReferenceError: __dirname is not defined` the first time
anything imports it. `bcrypt` shipped that way once and took the entire auth
path down with it.

Nitro knows the common native packages and traces them out of its own bundle
automatically, copying each into `.output/server/node_modules`. The dist image
ships only `.output`, so nothing else would put them there. Reach for
`traceDeps` on the `nitro()` plugin only for a package Nitro does not already
recognise — `@sentry/profiling-node` is the current case.

What Nitro cannot do is reclaim a package the **Vite** stage inlined first, and
the server is bundled in two stages. So a native package needs both of:

- **`environments.ssr.resolve.external`** in `apps/web/vite.config.js`, so the
  Vite stage leaves the import alone and it survives to Nitro's stage.
- **An entry in `apps/web/package.json` dependencies**, even when no file in
  `apps/web` imports it. Nitro resolves the external from the app root, and
  under pnpm a package reached only through a workspace package is not there.
  Add it to `ignoreDependencies` for `apps/web` in `knip.json` at the same
  time, or the dead-code gate fails on the dependency nothing imports.

### Verifying

A green build proves nothing here — the failure is at first import, at runtime.
Check the output:

```bash
grep -rn "__dirname" apps/web/.output/server/_ssr/
```

Every hit should be a line that *defines* `__dirname` before use. A bare read
means a native package was inlined.
