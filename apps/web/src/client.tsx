/// <reference types="vite/client" />
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

// Reload the page if a preload error occurs. These errors happen when a new
// version of the app bundle is deployed and a requested chunk no longer exists
// on the server. This is how the app picks up a redeploy: it reloads at the
// moment staleness actually breaks a navigation, rather than interrupting the
// user on every deploy. A sessionStorage guard caps it at one reload per session
// so a genuinely missing chunk surfaces the error instead of looping.
const PRELOAD_RELOAD_KEY = "vt-preload-reloaded";

function handlePreloadError() {
	// sessionStorage can throw in Safari private mode or under storage-restriction
	// policies. If it does, skip the guard and reload anyway rather than swallow
	// the error and leave the user on a broken page.
	try {
		if (window.sessionStorage.getItem(PRELOAD_RELOAD_KEY)) {
			return;
		}
		window.sessionStorage.setItem(PRELOAD_RELOAD_KEY, "1");
	} catch {
		// Ignore and fall through to the reload.
	}
	window.location.reload();
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
