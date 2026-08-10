import { accountQueryKeys } from "@account/keys";
import type { Account } from "@account/types";
import { faker } from "@faker-js/faker";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { rootQueryKeys } from "@wall/keys";
import "@testing-library/jest-dom/vitest";
import {
	fireEvent,
	renderHook,
	render as rtlRender,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createContext, type ReactNode, useContext, useState } from "react";
import { beforeEach, vi } from "vitest";
import { createFakeAccount } from "./fake/account";
import { accountServerFnMocks } from "./server-fn/account";
import { analysisServerFnMocks } from "./server-fn/analyses";
import { authServerFnMocks } from "./server-fn/auth";
import { groupServerFnMocks } from "./server-fn/groups";
import { hmmServerFnMocks } from "./server-fn/hmm";
import { indexServerFnMocks } from "./server-fn/indexes";
import { jobServerFnMocks } from "./server-fn/jobs";
import { labelServerFnMocks } from "./server-fn/labels";
import { genbankServerFnMocks, otuServerFnMocks } from "./server-fn/otus";
import { referenceServerFnMocks } from "./server-fn/references";
import { rootServerFnMocks } from "./server-fn/root";
import { sampleServerFnMocks } from "./server-fn/samples";
import {
	mockGetPasswordPolicy,
	settingsServerFnMocks,
} from "./server-fn/settings";
import { subtractionServerFnMocks } from "./server-fn/subtractions";
import { taskServerFnMocks } from "./server-fn/tasks";
import { uploadServerFnMocks } from "./server-fn/uploads";
import { userServerFnMocks } from "./server-fn/users";

vi.mock("@server/groups/functions", () => groupServerFnMocks);
vi.mock("@server/analyses/functions", async () => {
	const { analysisServerFnMocks } = await import("./server-fn/analyses");
	return analysisServerFnMocks;
});
vi.mock("@server/account/functions", async () => {
	const { accountServerFnMocks } = await import("./server-fn/account");
	return accountServerFnMocks;
});
// See the users mock below for why this resolves the mock via dynamic import.
vi.mock("@server/auth/functions", async () => {
	const { authServerFnMocks } = await import("./server-fn/auth");
	return authServerFnMocks;
});
// Resolve the mock lazily via dynamic import. A direct reference to the
// imported `userServerFnMocks` binding races route modules (pulled in by
// `routeTree`) that import the mocked module before this binding initializes.
vi.mock("@server/users/functions", async () => {
	const { userServerFnMocks } = await import("./server-fn/users");
	return userServerFnMocks;
});
vi.mock("@server/root/functions", async () => {
	const { rootServerFnMocks } = await import("./server-fn/root");
	return rootServerFnMocks;
});
vi.mock("@server/hmm/functions", async () => {
	const { hmmServerFnMocks } = await import("./server-fn/hmm");
	return hmmServerFnMocks;
});
vi.mock("@server/jobs/functions", async () => {
	const { jobServerFnMocks } = await import("./server-fn/jobs");
	return jobServerFnMocks;
});
vi.mock("@server/tasks/functions", async () => {
	const { taskServerFnMocks } = await import("./server-fn/tasks");
	return taskServerFnMocks;
});
vi.mock("@server/settings/functions", async () => {
	const { settingsServerFnMocks } = await import("./server-fn/settings");
	return settingsServerFnMocks;
});
vi.mock("@server/labels/functions", async () => {
	const { labelServerFnMocks } = await import("./server-fn/labels");
	return labelServerFnMocks;
});
vi.mock("@server/uploads/functions", async () => {
	const { uploadServerFnMocks } = await import("./server-fn/uploads");
	return uploadServerFnMocks;
});
vi.mock("@server/subtraction/functions", async () => {
	const { subtractionServerFnMocks } = await import("./server-fn/subtractions");
	return subtractionServerFnMocks;
});

vi.mock("@server/references/functions", async () => {
	const { referenceServerFnMocks } = await import("./server-fn/references");
	return referenceServerFnMocks;
});

vi.mock("@server/samples/functions", async () => {
	const { sampleServerFnMocks } = await import("./server-fn/samples");
	return sampleServerFnMocks;
});

vi.mock("@server/otus/functions", async () => {
	const { otuServerFnMocks } = await import("./server-fn/otus");
	return otuServerFnMocks;
});

vi.mock("@server/genbank/functions", async () => {
	const { genbankServerFnMocks } = await import("./server-fn/otus");
	return genbankServerFnMocks;
});

vi.mock("@server/indexes/functions", async () => {
	const { indexServerFnMocks } = await import("./server-fn/indexes");
	return indexServerFnMocks;
});

beforeEach(() => {
	for (const fn of Object.values(groupServerFnMocks)) {
		fn.mockReset();
	}
	for (const fn of [
		...Object.values(userServerFnMocks),
		...Object.values(accountServerFnMocks),
		...Object.values(jobServerFnMocks),
		...Object.values(taskServerFnMocks),
		...Object.values(hmmServerFnMocks),
		...Object.values(authServerFnMocks),
		...Object.values(labelServerFnMocks),
		...Object.values(rootServerFnMocks),
		uploadServerFnMocks.findUploadsFn,
		uploadServerFnMocks.deleteUploadFn,
		subtractionServerFnMocks.findSubtractionsFn,
		subtractionServerFnMocks.getSubtractionFn,
		subtractionServerFnMocks.listSubtractionsShortlistFn,
		referenceServerFnMocks.findReferencesFn,
		referenceServerFnMocks.getReferenceFn,
		sampleServerFnMocks.findSamplesFn,
		sampleServerFnMocks.getSampleFn,
		analysisServerFnMocks.findAnalysesFn,
		analysisServerFnMocks.getAnalysisFn,
		analysisServerFnMocks.getAnalysisResultsFn,
		settingsServerFnMocks.getSettingsFn,
		...Object.values(indexServerFnMocks),
		otuServerFnMocks.findOtusFn,
		otuServerFnMocks.getOtuFn,
		otuServerFnMocks.listOtuHistoryFn,
	]) {
		fn.mockReset();
		// Default to a pending promise so an un-stubbed query renders its loading
		// state instead of resolving to `undefined`.
		fn.mockReturnValue(new Promise(() => {}));
	}

	for (const fn of [
		subtractionServerFnMocks.createSubtractionFn,
		subtractionServerFnMocks.updateSubtractionFn,
		subtractionServerFnMocks.deleteSubtractionFn,
		referenceServerFnMocks.createReferenceFn,
		referenceServerFnMocks.updateReferenceFn,
		referenceServerFnMocks.archiveReferenceFn,
		referenceServerFnMocks.unarchiveReferenceFn,
		referenceServerFnMocks.addReferenceUserFn,
		referenceServerFnMocks.addReferenceGroupFn,
		referenceServerFnMocks.updateReferenceUserFn,
		referenceServerFnMocks.updateReferenceGroupFn,
		referenceServerFnMocks.removeReferenceUserFn,
		referenceServerFnMocks.removeReferenceGroupFn,
		sampleServerFnMocks.createSampleFn,
		sampleServerFnMocks.updateSampleFn,
		sampleServerFnMocks.deleteSampleFn,
		sampleServerFnMocks.updateSampleRightsFn,
		analysisServerFnMocks.createAnalysisFn,
		analysisServerFnMocks.deleteAnalysisFn,
		analysisServerFnMocks.blastNuvsFn,
		settingsServerFnMocks.updateSettingsFn,
		otuServerFnMocks.createOtuFn,
		otuServerFnMocks.updateOtuFn,
		otuServerFnMocks.deleteOtuFn,
		otuServerFnMocks.createIsolateFn,
		otuServerFnMocks.updateIsolateFn,
		otuServerFnMocks.setIsolateAsDefaultFn,
		otuServerFnMocks.deleteIsolateFn,
		otuServerFnMocks.createSequenceFn,
		otuServerFnMocks.updateSequenceFn,
		otuServerFnMocks.deleteSequenceFn,
		genbankServerFnMocks.getGenbankFn,
	]) {
		fn.mockReset();
	}

	// Unlike the mocks above, the password policy defaults to resolving. Every
	// password form queries it, and leaving it pending would silently exercise
	// the fallback minimum in tests that mean to assert the configured one.
	settingsServerFnMocks.getPasswordPolicyFn.mockReset();
	mockGetPasswordPolicy();
});

process.env.TZ = "UTC";

faker.seed(1);

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

	return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

export function renderWithProviders(ui: ReactNode) {
	// The client is built once and reused, so `rerender` re-renders the same tree
	// instead of handing React a new provider on every call.
	const queryClient = createTestQueryClient();

	function wrap(node: ReactNode) {
		return (
			<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
		);
	}

	// Re-wrap on rerender. Passing the bare element would change the type of the
	// root, so React would unmount and remount the tree rather than re-render it,
	// silently discarding effects, state, and the providers themselves.
	const { rerender, ...rest } = rtlRender(wrap(ui));

	return { ...rest, rerender: (node: ReactNode) => rerender(wrap(node)) };
}

export async function renderWithRouter(ui: ReactNode, path?: string) {
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

	const router = createRouter({
		routeTree: rootRoute,
		history: memoryHistory,
		defaultPendingMinMs: 0,
	});

	await router.load();

	const result = renderWithProviders(<RouterProvider router={router} />);
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

export async function renderHookWithRouter<T>(hook: () => T, path?: string) {
	const rootRoute = createRootRoute({ component: () => <Outlet /> });
	const catchAllRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "$",
		component: MemoryRouterCatchAll,
	});
	rootRoute.addChildren([catchAllRoute]);

	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({ initialEntries: [path || "/"] }),
		defaultPendingMinMs: 0,
	});

	await router.load();

	return renderHook(hook, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<MemoryRouterChildrenContext value={children}>
				<RouterProvider router={router} />
			</MemoryRouterChildrenContext>
		),
	});
}

type RenderRouteOptions = {
	account?: Account;
	seed?: (queryClient: QueryClient) => void;
};

export async function renderRoute(path: string, opts?: RenderRouteOptions) {
	// Imported lazily so the ~1,449-line route tree — and the route modules it
	// pulls in — only loads for the handful of tests that render a real route,
	// not every test file that imports this shared setup.
	const { routeTree } = await import("@/routeTree.gen");

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

	const result = rtlRender(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);

	return { ...result, router, queryClient };
}

// jsdom does not implement EventSource; the SSE bridge constructs one when the
// authenticated layout mounts, so any route-level test that renders it would
// throw. A noop stand-in keeps the connection inert during tests. The
// readyState constants are part of the surface: SseConnection reads
// `window.EventSource.CLOSED` to tell a rejected handshake from a dropped
// transport.
class FakeEventSource {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;

	readyState: number = FakeEventSource.CONNECTING;

	close() {
		this.readyState = FakeEventSource.CLOSED;
	}
	addEventListener() {}
	removeEventListener() {}
	dispatchEvent() {
		return true;
	}
	onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
	onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
	onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
}
// @ts-expect-error FakeEventSource only implements the surface SseConnection touches.
window.EventSource = FakeEventSource;

//mocks HTML element prototypes that are not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.scrollTo = vi.fn();

class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

function attachResizeObserver() {
	window.ResizeObserver = ResizeObserver;
}

attachResizeObserver();

// Globals are defined here to limit import redundancies.
const testGlobals = globalThis as typeof globalThis & {
	fireEvent: typeof fireEvent;
	userEvent: typeof userEvent;
	renderWithProviders: typeof renderWithProviders;
	wrapWithProviders: typeof wrapWithProviders;
};
testGlobals.fireEvent = fireEvent;
testGlobals.userEvent = userEvent;
testGlobals.renderWithProviders = renderWithProviders;
testGlobals.wrapWithProviders = wrapWithProviders;
