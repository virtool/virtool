/// <reference types="vite/client" />
import { handlePreloadError } from "@app/preloadReload";
import * as Sentry from "@sentry/tanstackstart-react";
import { StartClient } from "@tanstack/react-start/client";
import { type ErrorInfo, StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

// Browser-side Sentry initialisation lives in `router.tsx`'s `getRouter()` so it
// can wire `tanstackRouterBrowserTracingIntegration` to the router instance.

// React 19 surfaces render errors through `hydrateRoot`'s error hooks. Left
// unwired, an error that escapes every route error boundary falls to React's
// default handler, which hands it to `reportError()`; the browser then reports
// it via the global `error` event, stripped of the React component stack — and
// a `throw` of a non-`Error` value (e.g. `undefined`) arrives as an
// unattributable "Uncaught undefined" with no way to find the culprit. Attaching
// `errorInfo.componentStack` as event context names the throwing component even
// when the thrown value carries no stack of its own — `@sentry/react`'s
// `reactErrorHandler` only sets it for real `Error` values, so it wouldn't help
// the `undefined` case this exists to catch.
function captureReactError(error: unknown, errorInfo: ErrorInfo) {
	Sentry.captureException(error, {
		contexts: {
			react: { componentStack: errorInfo.componentStack ?? undefined },
		},
	});
}

window.addEventListener("vite:preloadError", handlePreloadError);

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
		{
			// `onCaughtError` is deliberately omitted: caught errors flow through
			// the router's error boundary (`RouteError`), which renders expected
			// 401/403/404 states, so reporting them would bury real crashes in
			// routine noise.
			onUncaughtError: captureReactError,
			onRecoverableError: captureReactError,
		},
	);
});
