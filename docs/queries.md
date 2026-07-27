# Queries and caching

Data fetching in the SPA goes through
[TanStack Query](https://tanstack.com/query) (React Query, v5) regardless of
the underlying transport. Two transports coexist while the backend migrates:

- **Legacy path** — superagent calls the Python API through the shared
  `apiClient` in `apps/web/src/app/api.ts`. Error shape is
  `error.response?.body.message`.
- **New path** — TanStack Start server functions under
  `apps/web/src/server/<feature>/`, called from the SPA via React Query
  hooks.

Either way, the cache surface is the same. A feature splits it across two
modules:

- `keys.ts` — the `*QueryKeys` factory, and nothing else.
- `queries.ts` — `queryOptions`-based helpers and `use*` hooks.

There is no separate per-feature `api.ts` — the request logic lives directly
inside the hook's `queryFn`/`mutationFn` (or a `queryOptions` factory).
Inline the `apiClient` call; reach for a module-private helper only when the
same request is shared by more than one hook or selected between branches.

## Query keys come from `createQueryKeys`

A query key is a tuple of primitives that uniquely identifies a cached
request. Keys must be:

- **Distinct** — every request with different parameters gets a different
  key. `list([5, 25])` and `list([6, 25])` are different keys.
- **Deterministic** — the same parameters always produce the same key. Pick
  an argument order and stick to it across call sites.
- **Hierarchical** — invalidating a shorter key invalidates every longer
  key beneath it. `invalidateQueries({ queryKey: samplesQueryKeys.lists() })`
  marks every cached list of samples stale; `samplesQueryKeys.all()` marks
  every sample query stale, lists and details alike.

Nothing hand-writes a key. Every feature that caches data exports a
`*QueryKeys` built by `createQueryKeys(domain)` from `@app/queryKeys`, out of
its own `keys.ts`:

```ts
// src/samples/keys.ts
import { createQueryKeys } from "@app/queryKeys";

export const samplesQueryKeys = createQueryKeys("samples");
```

That yields seven members — `all`, `lists`, `list`, `infiniteLists`,
`infiniteList`, `details`, and `detail`:

```ts
samplesQueryKeys.all();               // ["samples"]
samplesQueryKeys.lists();             // ["samples", "list"]
samplesQueryKeys.list([5, 25]);       // ["samples", "list", 5, 25]
samplesQueryKeys.infiniteList([25]);  // ["samples", "list", "infinite", 25]
samplesQueryKeys.details();           // ["samples", "details"]
samplesQueryKeys.detail("abc");       // ["samples", "details", "abc"]
```

The hierarchy holds *by construction*: every list variant extends `lists()`
and every detail extends `details()`, because the factory builds the longer
keys by spreading the shorter ones. A feature cannot end up with a
`details()` that fails to invalidate its own `detail(id)`, and a domain that
caches nothing under a member simply never calls it — an unused member costs
nothing, so there is no reason to trim the set.

This is what makes a single `invalidateQueries({ queryKey: lists() })` in a
mutation's `onSuccess` — or in the SSE handler — refresh *every* cached view
of the collection.

### `keys.ts` imports nothing but `@app/queryKeys`

Keys live apart from the hooks because a key is a pure function over
primitives, while the hooks around it drag in the whole request layer:
superagent, zod, and the TanStack Start server-function stubs. Anything that
only needs to *invalidate* a cache — the SSE handler, a route's `beforeLoad`,
a mutation in a neighbouring feature — imports `@<feature>/keys` and pays
none of that.

This is not a style preference. The SSE handler invalidates twelve domains,
so importing each one's `queries.ts` for its key put five feature query
modules and four server-function stubs — and, through them, a duplicate copy
of zod — into the chunk that every authenticated page loads. Moving those
twelve imports to `keys.ts` cut that chunk by 40 KB gzipped.

Two rules keep it that way:

- **`keys.ts` imports `@app/queryKeys` and nothing else.** No types from
  `./types`, no constants from elsewhere in the feature. If a key needs a
  value that isn't a primitive it takes, the key is wrong.
- **`queries.ts` does not re-export its keys.** It imports them from
  `./keys` like everyone else. A convenience re-export is a second, heavier
  door onto the same value, and it is the one an import completion will
  offer.

`reactQueryHandler.test.ts` asserts the handler imports no `queries` module,
because nothing else would fail if it did.

### Extra members derive from a base key

A feature sometimes caches something that is none of the seven shapes: a
flat list for a selector, an OTU's change history, the one active banner.
Spread the factory and derive the extra member **from a base key**, so it
lands inside the hierarchy rather than beside it:

```ts
// src/users/keys.ts
const userKeys = createQueryKeys("users");

export const userQueryKeys = {
  ...userKeys,
  nested: () => [...userKeys.lists(), "nested"] as const,
};
```

Because `nested()` extends `lists()`, one `lists()` invalidation still
refreshes it. Hoisting it to a sibling instead (say, `["users", "nested"]`)
silently removes it from that invalidation: nothing fails to compile and no
test breaks, the selector just stops updating.

Derive from the key whose invalidation *should* reach the new member. An
OTU's history nests under that OTU's `detail(id)`, so the mutations that
invalidate the OTU also refresh the history they just appended to. A
reference's unbuilt changes are keyed by reference, not by index, so they
get their own segment under `all()` rather than squatting in the index
details namespace.

Give each variant its own segment rather than letting it land on a prefix
that is already a key. `list([])` collapses to `["users", "list"]` — exactly
`lists()` — which parks a real cache entry on the invalidation prefix, where
any `setQueryData(lists(), …)` would clobber it. A collection with no filters
should key off `lists()` deliberately, not arrive there by passing an empty
filter array.

### The SSE handler declares what each domain caches

`app/sse/reactQueryHandler.ts` maps a pushed frame to the narrowest key it
can invalidate: `detail(id)` for an update, `lists()` for an insert or
delete. Not every domain caches both — the account is a singleton cached at
`all()`, tasks cache no list, labels cache no detail — and invalidating a key
nothing is cached under is a **silent no-op**, not an error.

So the handler's registry states, per domain, whether it caches details and
whether it caches lists, and falls back to `all()` when it doesn't. Do not
try to infer that from the keys: every domain has every member now, so their
presence says nothing about what is cached. When a feature starts caching a
shape it didn't before, flip its flag in that registry.

## Share query config with `queryOptions()`

Declare a query's key and fetcher once with the `queryOptions()` helper, then
reuse the same options from hooks and route loaders:

```ts
export function sampleQueryOptions(sampleId: string) {
  return queryOptions<Sample, ErrorResponse>({
    queryKey: samplesQueryKeys.detail(sampleId),
    queryFn: () =>
      apiClient.get(`/samples/${sampleId}`).then((res) => res.body),
  });
}

export function useFetchSample(sampleId: string) {
  return useQuery(sampleQueryOptions(sampleId));
}
```

Annotate the `queryOptions` generic (`<Sample, ErrorResponse>`) when the
fetcher is inlined — `apiClient` responses are untyped, so without it the
cached data type degrades to `any`.

The same options object can be passed to `queryClient.ensureQueryData` from
a route loader without duplicating the key or fetcher.

## Prefer route loaders for prefetch

Page-level data should be prefetched in the route's `loader`, not by a
parent component that exists only to fetch on behalf of children. The
router runs the loader during navigation, so the cache is warm by the time
the component mounts — `useQuery` inside the page hits the cache
immediately:

The `queryOptions` factory is pulled in with a **dynamic import inside the
loader body**, never a static import at the top of the route file:

```ts
export const Route = createFileRoute("/_authenticated/samples/$sampleId")({
  loader: async ({ context: { queryClient }, params: { sampleId } }) => {
    const { sampleQueryOptions } = await import("@samples/queries");
    await queryClient.ensureQueryData(sampleQueryOptions(sampleId));
  },
  component: SampleDetail,
});
```

`loader` is a *critical* route export: `routeTree.gen.ts` imports it
statically, so a top-level `import { sampleQueryOptions } from
"@samples/queries"` puts that module — and through it `@app/api`, superagent,
and the feature's whole request layer — into the eager bundle every page load
pays for, `/login` included. The dynamic import moves it into a chunk the
loader fetches only when the route is actually visited. The route's
`component` half is already lazy, so importing hooks like `useSuspenseSample`
at the top of the file is fine.

When a loader needs several modules, import them together so the fetches
overlap:

```ts
const [{ otuQueryOptions }, { referenceQueryOptions }] = await Promise.all([
  import("@otus/queries"),
  import("@references/queries"),
]);
```

`ensureQueryData` is a no-op when the data is already cached, so the same
hook works whether the user arrived from a list page (warm) or via a direct
URL (cold). When a page needs multiple resources, run the `ensureQueryData`
calls in parallel with `Promise.all`.

For data that isn't needed on initial render (e.g. a dialog that opens
lazily), skip the loader and call `useQuery` where the data is consumed.

## Loading and error states: two tiers

A query has three outcomes — pending, error, success — and a consumer has to
account for all three. Pick the tier by how central the data is to the view,
and never collapse pending and error into one branch. The guard
`if (isPending || !data) return <LoadingPlaceholder />` is the anti-pattern: on
error `data` is `undefined`, so a failed request falls into the loading branch
and spins forever instead of showing the error.

### Tier 1 — primary data, via Suspense and the route error boundary

For the resource a route exists to show (detail pages, the record the URL is
"about"), let the framework handle pending and error declaratively:

1. Prefetch in the route `loader` with `ensureQueryData` (above).
2. Read it in the component with `useSuspenseQuery` — expose a
   `useSuspense*` hook next to the `useFetch*` one:

   ```ts
   export function useSuspenseSample(sampleId: string) {
     return useSuspenseQuery(sampleQueryOptions(sampleId));
   }
   ```

3. In the component, destructure `data` and use it directly — **no guard**.
   `useSuspenseQuery` guarantees `data` is defined, and a failure throws.

   ```tsx
   function SampleDetailLayout() {
     const { sampleId } = Route.useParams();
     const { data } = useSuspenseSample(sampleId);
     return <ViewHeader title={data.name} />;
   }
   ```

Loading is absorbed by the `<Suspense>` boundary already wrapping the
authenticated `<Outlet>`. Errors are caught by the router's
`defaultErrorComponent` (`@base/RouteError`), wired once in `router.tsx`, and
by the root route's own `errorComponent` (also `@base/RouteError`, in
`routes/__root.tsx`) which catches failures in the root shell that the default
wouldn't. `RouteError` reads the HTTP status off the error and renders a
permission message for 403, a not-found for 404, and otherwise the shared
`@base/ErrorState` primitive (a centered icon + message + "Try again" action).
A route only needs its own `errorComponent` when it wants bespoke copy; reach
for `@base/ErrorState` directly when a non-route view needs the same generic
"something went wrong" fallback.

Keep a loader's `404 → notFound()` mapping where it exists — that routes a
missing record to the dedicated `notFoundComponent` rather than the error
boundary.

### Tier 2 — secondary data, handled inline with `useQuery`

For data that should fail without taking over the page — paginated lists using
`keepPreviousData`, polling, sidebar widgets, anything optional — stay on
`useQuery` and handle the states explicitly. Render the inline error with
`@base/QueryError` (a red `Alert` taking a `noun`), and gate it on
`isError && !data` — error **only when there's nothing to show** — then handle
`isPending`:

```tsx
const { data, isPending, isError } = useListSamples(page, perPage);

if (isError && !data) {
  return <QueryError noun="samples" />;
}
if (isPending) {
  return <LoadingPlaceholder />;
}
```

The `&& !data` is load-bearing, not defensive. In React Query v5 `error` and
`data` coexist: once a query has loaded successfully, `data` survives a later
failed refetch (the retries-exhausted `refetchError` state). A bare
`if (isError)` would blank an already-rendered list the moment a background
refetch fails — the opposite of Tier 2's job. `isError && !data` shows the
inline error only on an initial-load failure (the real "spins forever" case
this replaces) and keeps stale data on screen through background errors. The
guard still narrows `data` to defined for the success branch, because the only
error state left past it carries `data`.

`if (isPending || !data) return <LoadingPlaceholder />` remains the
anti-pattern: it puts `!data` in the **loading** branch, so an initial-load
failure (where `data` is `undefined`) spins forever instead of erroring.

For a view backed by several `useQuery` calls, the same rule generalises —
error only when something needed is still missing:

```tsx
if ((isErrorA || isErrorB) && (!dataA || !dataB)) {
  return <QueryError noun="files" />;
}
if (isPendingA || isPendingB) {
  return <LoadingPlaceholder />;
}
```

The distinction is deliberate: Tier 1 escalates a failure to a full-route
error state; Tier 2 contains it so the rest of the page keeps working. Make a
view *eager* (error even with stale data on screen) only when staleness
actively misleads — permissions, balances, live job status.

## Pagination keeps the previous page on screen

`placeholderData: keepPreviousData` keeps the previous page visible while
the next one fetches, instead of flashing a spinner. Apply it to any
paginated list:

```ts
return useQuery<SampleSearchResult, ErrorResponse>({
  queryKey: samplesQueryKeys.list([page, per_page, term, labels, workflows]),
  queryFn: () =>
    apiClient
      .get("/samples")
      .query({ page, per_page, find: term, label: labels, workflows })
      .then((res) => {
        const { documents, ...rest } = res.body;
        return { ...rest, items: documents };
      }),
  placeholderData: keepPreviousData,
});
```

This is the v5 replacement for the old `keepPreviousData: true` flag —
don't reintroduce the boolean form.

## Mutation callbacks: definition-time vs call-time

`useMutation` accepts callbacks (`onSuccess`, `onError`, `onSettled`) in
two places, and the difference is load-bearing:

- At **definition time** — passed to `useMutation({ onSuccess, ... })`.
  These fire regardless of whether the calling component is still mounted.
- At **call time** — passed to `mutate(vars, { onSuccess, ... })`. These
  only fire if the component that called `mutate` is still mounted when the
  response arrives.

Use the split deliberately:

- Cache invalidation belongs at definition time — the cache must update
  whether or not the user navigated away.
- Navigation, toasts, and other UI side effects belong at call time — they
  don't make sense after the component is gone.

```ts
export function useUpdateSample(sampleId: string) {
  const queryClient = useQueryClient();
  return useMutation<Sample, ErrorResponse, { update: SampleUpdate }>({
    mutationFn: ({ update }) => updateSampleFn(sampleId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: samplesQueryKeys.detail(sampleId),
      });
    },
  });
}
```

## Update strategy: invalidate, don't patch

When data goes stale — from a user action, a server-push event, or a
successful mutation — invalidate the relevant keys and let React Query
refetch. The hierarchical key structure means one
`invalidateQueries({ queryKey: samplesQueryKeys.lists() })` covers every
paginated list at once.

Reserve in-place cache writes (`queryClient.setQueryData`) for very
high-frequency updates where refetch cost dominates. Hand-written cache
patches couple the writer to the response shape and bypass server-side
filtering and ordering, so they're easy to get subtly wrong.
