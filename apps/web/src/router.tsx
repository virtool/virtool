import { handleQueryError, shouldRetryQuery } from "@app/queryErrors";
import { readSentryDsn } from "@app/sentryDsn";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import RouteError from "@base/RouteError";
import * as Sentry from "@sentry/tanstackstart-react";
import { getRequestNonce } from "@server/csp";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getCommonOptions } from "@virtool/sentry/browser";
import { CONTENT_SCROLL_ID } from "./app/scroll";
import { scheduleReplay } from "./app/sentryReplay";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const queryClient = new QueryClient({
		queryCache: new QueryCache({ onError: handleQueryError }),
		mutationCache: new MutationCache({ onError: handleQueryError }),
		defaultOptions: {
			queries: {
				retry: shouldRetryQuery,
				// SSE push keeps caches fresh, so this only bounds how long a
				// missed invalidation can serve stale data before a focus or
				// mount refetch corrects it.
				staleTime: 30 * 1000,
			},
		},
	});

	const router = createRouter({
		routeTree,
		context: { queryClient },
		// Every route inherits this error boundary unless it sets its own
		// `errorComponent`. It catches both rejected loaders and errors thrown
		// from `useSuspenseQuery` during render, so a failed query surfaces a
		// real error state instead of an indefinite loading placeholder.
		defaultErrorComponent: RouteError,
		// Without a pending component, a route's loader gets no loading state at
		// all on a soft navigation: `setupPendingTimeout` only arms the
		// `defaultPendingMs` timer when `pendingComponent ?? defaultPendingComponent`
		// is set, so `onReady` never fires early and the router leaves the
		// *previous* page on screen for however long the loader runs. Routes whose
		// loader is instant are unaffected — the timer never elapses — so this only
		// shows up where the wait is real (a pathoscope analysis document).
		defaultPendingComponent: LoadingPlaceholder,
		// `defaultPendingMinMs` is deliberately left at the router's default. Do
		// not set it to 0: on a hard load, `hydrate()` only arms `_forcePending`
		// when it is truthy, and that flag is what makes `loadMatches` commit the
		// pending matches up front instead of after every loader has settled. With
		// it at 0, a rendered match sits at `status: "pending"` while the loader
		// that owns its (shared) `loadPromise` finishes and clears it — so
		// `MatchInner` throws `undefined`, `CatchBoundary` tests the thrown value
		// for truthiness and lets it through, and the whole app unmounts to a blank
		// page. The window stays open for as long as the slowest loader in the
		// chain runs, which is why only routes with a slow loader (a pathoscope
		// analysis document) hit it. See TanStack/router#7753.
		//
		// Keeping the default only narrows that window; it does not close it. A
		// chained redirect clears the same promise on a match the router is still
		// rendering, which is how signing in could land on a blank page. The
		// unmount itself is caught by `@base/ShellErrorBoundary` — this option is
		// what keeps it rare, not what makes it survivable.
		// Preload routes on hover/touch/focus. Loaders back onto React Query via
		// `ensureQueryData`, so a 0 preload stale time hands freshness decisions
		// entirely to React Query's own `staleTime`/`gcTime` instead of letting
		// the router's 30s default short-circuit preloads.
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// The document no longer scrolls — the authenticated shell scrolls an
		// inner container so the navbar can stay full-bleed with a stable
		// scrollbar gutter. Point scroll-to-top on navigation at that container;
		// back/forward restoration of it is handled automatically by the watcher.
		scrollRestoration: true,
		scrollToTopSelectors: [`#${CONTENT_SCROLL_ID}`],
	});

	// Carries the server's query cache to the browser. Without it every query a
	// loader or `useSuspenseQuery` resolved server-side would be refetched
	// immediately after hydration, so SSR would cost a round trip rather than
	// save one. Queries that resolve while the document is still streaming are
	// dehydrated as they land, which is what lets a slow one (the pathoscope
	// results) arrive after the shell has already painted.
	//
	// `wrapQueryClient` is off because the root route renders its own
	// `QueryClientProvider`; leaving it on would nest a second one.
	setupRouterSsrQueryIntegration({
		router,
		queryClient,
		wrapQueryClient: false,
	});

	// Router and React stamp this nonce onto every script they emit, including
	// the inline ones a CSP's `script-src 'self'` cannot cover: the dehydration
	// payload and React's suspense-resolution frames. Router only ever reads
	// this option, so supplying the value is ours to do. `getRouter` runs once
	// per request, so this is the request's own nonce — the same one the
	// document-header middleware names in `script-src`.
	if (import.meta.env.SSR) {
		router.options.ssr = { nonce: getRequestNonce() };
	}

	// `import.meta.env.SSR` is a compile-time constant, so the whole block is
	// dead-code-eliminated from the server bundle. `browserProfilingIntegration`
	// has no server stub (unlike the replay/tracing integrations), so leaving the
	// reference in the SSR build would warn about an undefined import.
	if (!import.meta.env.SSR) {
		// The DSN comes from a `<meta>` tag the server renders from its runtime
		// env (see `@app/sentryDsn` and the root route's `head`), not from a
		// build-time `import.meta.env.VT_SENTRY_DSN` inline that would freeze in
		// whatever DSN (usually none) was present when the image was built.
		// `MODE` is read from `import.meta.env.MODE`: it is the build mode and
		// only drives sample rates.
		const options = getCommonOptions({
			MODE: import.meta.env.MODE,
			VT_SENTRY_DSN: readSentryDsn(),
		});
		if (options.dsn) {
			Sentry.init({
				...options,
				// Route envelopes through a same-origin tunnel so ad-blockers and
				// strict CSP can't drop them — see `routes/monitoring.ts`.
				tunnel: "/monitoring",
				integrations: [
					Sentry.tanstackRouterBrowserTracingIntegration(router),
					Sentry.browserProfilingIntegration(),
				],
			});
			// Replay is registered after first paint rather than here — see
			// `scheduleReplay`. Its sample rates still come from `options`.
			scheduleReplay();
		}
	}

	return router;
}

declare module "@tanstack/react-router" {
	// biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation merges into TanStack Router's Register interface
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
