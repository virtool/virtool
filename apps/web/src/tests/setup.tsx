import { accountQueryKeys } from "@account/keys";
import { RecentAuthenticationProvider } from "@app/recentAuthentication";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	type HistoryState,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render as rtlRender } from "@testing-library/react";
import type { Account } from "@virtool/contracts";
import { rootQueryKeys } from "@wall/keys";
import { createContext, type ReactNode, useContext, useState } from "react";
import { vi } from "vitest";
import { createFakeAccount } from "./fake/account";

/**
 * A `QueryClient` configured for tests: retries are off so an error-state test
 * asserts the failure immediately instead of waiting through three retries with
 * backoff.
 */
export function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
}

/**
 * Return the element at `index`, throwing if the array has no such element.
 *
 * Lets tests index into fixture data they built without a non-null assertion,
 * which `noUncheckedIndexedAccess` would otherwise require.
 */
export function at<T>(items: readonly T[], index: number): T {
	const item = items[index];
	if (item === undefined) {
		throw new Error(`expected an element at index ${index}`);
	}
	return item;
}

export function wrapWithProviders(ui: ReactNode) {
	const queryClient = createTestQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			<RecentAuthenticationProvider>{ui}</RecentAuthenticationProvider>
		</QueryClientProvider>
	);
}

/**
 * Render `ui` with the application's providers.
 *
 * No HTTP interceptor runs in tests. A missing mock of a server function or of
 * the module that starts a raw request can cause a real request.
 */
export function renderWithProviders(ui: ReactNode) {
	// The client is built once and reused, so `rerender` re-renders the same tree
	// instead of handing React a new provider on every call.
	const queryClient = createTestQueryClient();

	function wrap(node: ReactNode) {
		return (
			<QueryClientProvider client={queryClient}>
				<RecentAuthenticationProvider>{node}</RecentAuthenticationProvider>
			</QueryClientProvider>
		);
	}

	// Re-wrap on rerender. Passing the bare element would change the type of the
	// root, so React would unmount and remount the tree rather than re-render it,
	// silently discarding effects, state, and the providers themselves.
	const { rerender, ...rest } = rtlRender(wrap(ui));

	return { ...rest, rerender: (node: ReactNode) => rerender(wrap(node)) };
}

export async function renderWithRouter(
	ui: ReactNode,
	path?: string,
	state?: HistoryState,
) {
	const rootRoute = createRootRoute();
	const catchAllRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "$",
		component: () => ui,
	});
	rootRoute.addChildren([catchAllRoute]);

	const memoryHistory = createMemoryHistory({
		initialEntries: [path || "/"],
	});
	if (state) {
		memoryHistory.replace(path || "/", state);
	}

	const router = createRouter({
		routeTree: rootRoute,
		history: memoryHistory,
		defaultPendingMinMs: 0,
	});

	await router.load();

	// Async `act` also covers effects that fetch on mount, whose updates would
	// otherwise land after this function returns.
	const result = await act(async () =>
		renderWithProviders(<RouterProvider router={router} />),
	);
	return { ...result, router };
}

const MemoryRouterChildrenContext = createContext<ReactNode>(null);

function MemoryRouterCatchAll() {
	return <>{useContext(MemoryRouterChildrenContext)}</>;
}

export function MemoryRouter({
	children,
	path,
}: {
	children: ReactNode;
	path?: string;
}) {
	const [router] = useState(() => {
		const rootRoute = createRootRoute({ component: () => <Outlet /> });
		const catchAllRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "$",
			component: MemoryRouterCatchAll,
		});
		rootRoute.addChildren([catchAllRoute]);

		return createRouter({
			routeTree: rootRoute,
			history: createMemoryHistory({ initialEntries: [path || "/"] }),
			defaultPendingMinMs: 0,
		});
	});

	return (
		<MemoryRouterChildrenContext value={children}>
			<RouterProvider router={router} />
		</MemoryRouterChildrenContext>
	);
}

type RenderRouteOptions = {
	account?: Account;
	seed?: (queryClient: QueryClient) => void;
};

export async function renderRoute(path: string, opts?: RenderRouteOptions) {
	// Imported lazily so the ~1,449-line route tree — and the route modules it
	// pulls in — only loads for the handful of tests that render a real route,
	// not every test file that imports this shared setup.
	const [{ routeTree }, { default: ShellErrorBoundary }] = await Promise.all([
		import("@/routeTree.gen"),
		import("@base/ShellErrorBoundary"),
	]);

	// The real shell renders `<html>`, which can only sit at the document root.
	// Testing Library mounts into a `<div>`.
	Object.assign(routeTree.options, { shellComponent: ShellErrorBoundary });

	const queryClient = createTestQueryClient();

	queryClient.setQueryData(rootQueryKeys.all(), { firstUser: false });
	queryClient.setQueryData(
		accountQueryKeys.all(),
		opts?.account ?? createFakeAccount(),
	);

	if (opts?.seed) {
		opts.seed(queryClient);
	}

	const memoryHistory = createMemoryHistory({ initialEntries: [path] });

	const router = createRouter({
		routeTree,
		history: memoryHistory,
		defaultPendingMinMs: 0,
		context: { queryClient },
	});

	await router.load();

	const result = await act(async () =>
		rtlRender(
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		),
	);

	// Two things finish after the render, and in a browser they can finish
	// after the test's assertions. Waiting for them inside `act` keeps their
	// updates in the test's scope:
	//
	// - On mount, `RouterProvider` writes the search defaults into the URL, and
	//   that starts a second load. The route modules that `beforeLoad` imports
	//   arrive over the network.
	// - The authenticated layout renders `UploadOverlay` through `React.lazy`.
	//   An import of a module settles after the earlier imports of that module,
	//   so when this one settles, React's has too.
	await act(() =>
		Promise.all([
			import("@uploads/components/UploadOverlay"),
			vi.waitFor(() => {
				const { matches, status } = router.state;

				if (status !== "idle" || matches.some((match) => match.isFetching)) {
					throw new Error("the router is still loading");
				}
			}),
		]),
	);

	return { ...result, router, queryClient };
}
