import "@app/style.css";
import { readSentryDsn, SENTRY_DSN_META_NAME } from "@app/sentryDsn";
import { readServerNow, SERVER_NOW_META_NAME } from "@app/serverNow";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import NotFound from "@base/NotFound";
import RouteError from "@base/RouteError";
import ShellErrorBoundary from "@base/ShellErrorBoundary";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

type RouterContext = {
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => {
		// The browser Sentry SDK reads its DSN from this tag (see
		// `@app/sentryDsn`). Rendering it here — from the server's runtime
		// `process.env` — is what carries the DSN to the client without baking it
		// into the build. Omitted entirely when unset so dev and unconfigured
		// deploys render nothing and the SDK stays off.
		const sentryDsn = readSentryDsn();
		return {
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ httpEquiv: "X-UA-Compatible", content: "IE=edge" },
				{ title: "Virtool" },
				// The instant every server-rendered relative time was measured
				// against. The browser reads it back to render the same strings
				// during hydration, then switches to its own clock. See
				// `@app/serverNow`.
				{ name: SERVER_NOW_META_NAME, content: String(readServerNow()) },
				...(sentryDsn
					? [{ name: SENTRY_DSN_META_NAME, content: sentryDsn }]
					: []),
			],
			links: [
				{
					rel: "shortcut icon",
					href: "/images/favicon.ico",
					type: "image/x-icon",
				},
				// Only the roman latin face is on the first-paint path. The italic and
				// the other unicode-range slices load on demand. `crossOrigin` is
				// required even same-origin: fonts fetch in CORS mode, and a preload
				// without it is fetched twice.
				{
					rel: "preload",
					href: interLatin,
					as: "font",
					type: "font/woff2",
					crossOrigin: "anonymous",
				},
			],
		};
	},
	shellComponent: RootShell,
	component: RootComponent,
	pendingComponent: LoadingPlaceholder,
	errorComponent: RouteError,
	notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
	return <NotFound />;
}

function RootShell({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{/* Above every route match, so a value the router's own boundaries
				    cannot catch stops here instead of unmounting the page. `Scripts`
				    stays outside it — the reload prompt is worthless without them. */}
				<ShellErrorBoundary>{children}</ShellErrorBoundary>
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	const { queryClient } = useRouteContext({ from: Route.id });

	return (
		<QueryClientProvider client={queryClient}>
			<Outlet />
		</QueryClientProvider>
	);
}
