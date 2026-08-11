# Server-side rendering

Every route renders on the server for a hard load. `createStart` sets no
`defaultSsr`, so it defaults to `true`: a route's `beforeLoad`, `loader`
and `component` all run in Node for the initial request, and the browser
receives finished HTML that it hydrates. Subsequent navigations are
client-side as before.

## What SSR settings a route can take

A route sets `ssr` to one of three values:

- `true` — `beforeLoad`, `loader` and the component all run on the server.
- `'data-only'` — `beforeLoad` and `loader` run on the server, but the
  component renders only in the browser.
- `false` — none of them run on the server; everything happens during
  hydration.

**An inherited setting can only be made more restrictive.** A child may
turn `true` into `'data-only'` or `false`, but a child of an `ssr: false`
parent cannot opt back in — `isBeforeLoadSsr` pins every descendant of a
`false` match to `false`. `defaultSsr` fills in for any route that does
not name a value, *including the root*, so setting `defaultSsr: false`
turns SSR off for the entire tree and no leaf can escape it. Turning SSR
off for one page is a per-route `ssr: false`, never a change to the
default.

## Render has to be pure of the browser and the clock

Server render has no `window`, no `document`, no `localStorage` and no
viewer timezone. Two distinct failure modes follow, and they need
different fixes.

**Reading a browser global during render crashes the render.** Not just
`window.foo` — anything that reaches one on the render path. Guarding
with `typeof window !== "undefined"` converts the crash into the second
failure mode rather than fixing it, because the server then renders one
thing and the browser another with nothing to reconcile them.

**Rendering a value the server cannot know produces a hydration
mismatch.** The clock, the timezone, the locale, the viewport. React
compares the server's markup against the client's first render and
complains when they disagree.

The tool for both is `useSyncExternalStore` with a *stable* server
snapshot, which React uses for the server render **and** for the
hydration render that has to match it, before swapping in the real value
on the next pass:

```ts
export function useIsSecureContext(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    readIsSecureContext,
    readIsSecureContextOnServer, // always false
  );
}
```

The snapshot must be cached. `useSyncExternalStore(subscribe, Date.now,
Date.now)` is not: React calls the getter repeatedly to decide whether the
store changed, so a reading that differs every call never settles, and
React warns and re-renders until it does. Advance a module-level value on
a tick and return that instead.

## `<title>` takes one string child

React's server renderer only serializes a `<title>` whose `children` is a
single string, number or bigint. Given anything else it writes an empty
element and warns. The browser has no such restriction, so it renders the
real text at hydration and the two disagree — and because this is a text
mismatch inside the page, React discards the server markup for that
subtree and re-renders it on the client, which is precisely the work SSR
exists to avoid.

The trap is that the offending form does not look like an array:

```tsx
<title>Progress: {progress}%</title>        {/* three children */}
<title>{`Progress: ${progress}%`}</title>   {/* one */}
```

It applies to `<title>` inside an `<svg>` too, where it is the graphic's
accessible name — `@base/ProgressCircle` renders one per job, sample,
subtraction, reference and analysis row, so the empty element cost every
list page both its accessible name and its server render.

## Time

Anything measuring elapsed time reads `@app/serverNow`, never the clock
during render. The server takes its own clock once per request
(`@server/requestTime`, keyed on the request object so concurrent renders
cannot share an instant), the root route renders it into a `<meta>` tag,
and the browser reads that value back so the hydration render reproduces
the server's strings exactly. After hydration the component follows the
browser's clock.

A module-level `let now = Date.now()` is **not** a substitute. In a
browser that is page load; on a server it is whenever the process
imported the file, so on a pod that has been up for days every timestamp
is measured against a deploy that happened days ago.

Absolute times are a different problem: `toLocaleTimeString` and the
local-date getters read the container's timezone, not the viewer's, and
there is no value the server can send that fixes it. Hold those back
until hydration with `useHydrated` and render a placeholder of the same
width — `suppressHydrationWarning` will not do, because React does not
patch a suppressed text mismatch and the server's timezone would stay on
screen.

## Genuinely browser-only subtrees

Some things cannot render on the server at all. A virtualized list
decides which rows exist by measuring its scroll container, so the server
emits nothing and hydration finds a full list. Wrap those in `ClientOnly`
from `@tanstack/react-router` with a fallback that holds the same
dimensions, so the rows land without moving anything:

```tsx
<ClientOnly fallback={<div style={{ height: rows * ROW_HEIGHT }} />}>
  {/* virtualized rows */}
</ClientOnly>
```

Prefer this over `ssr: false` on the route. Opting the whole route out
gives up server rendering for everything else on the page — on the
analysis viewer that would include the part SSR exists to accelerate.

## Module state is now per-process, not per-user

A `let` at module scope in client code used to be per-tab. On the server
it is shared by every request the process handles concurrently. Nothing
in the client tree may keep per-user state at module scope and read it
during render. The two zustand stores (`@app/serverVersion`,
`@uploads/uploader`) are safe only because they are populated from
browser-side events that never fire on the server, so a server render
always sees their initial state.

## React Query

`setupRouterSsrQueryIntegration` (`router.tsx`) carries the server's
query cache to the browser. Without it every query a loader or a
`useSuspenseQuery` resolved on the server would be refetched straight
after hydration, and SSR would cost a round trip rather than save one.
`wrapQueryClient` is off because the root route renders its own
`QueryClientProvider`.

**Only `useSuspenseQuery` and loader prefetches participate in SSR.** A
plain `useQuery` does not fetch on the server; it starts in the browser
after hydration, which is the right behaviour for the secondary data it
is reserved for. A query that resolves while the document is still
streaming is dehydrated as it lands, which is what lets a slow one — the
pathoscope results, deliberately started with `prefetchQuery` and not
awaited — arrive after the shell has already painted.

## The CSP nonce

Scripts in a server-rendered document carry a per-request nonce, because
Router serializes the dehydrated router state into an *inline* script and
React emits inline scripts of its own as suspense boundaries resolve;
`script-src 'self'` covers neither. `getRouter` sets
`router.options.ssr.nonce` from `@server/csp`, and Router stamps it onto
every tag it emits — `HeadContent` also renders the
`<meta property="csp-nonce">` tag the browser reads it back from.

Do not reintroduce a middleware that rewrites the HTML to add nonces.
Reading the response body buffers the whole stream, which gives up
progressive rendering for markup that already carries them.
