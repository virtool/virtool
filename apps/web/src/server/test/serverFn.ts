import { runWithStartContext } from "@tanstack/start-storage-context";

/**
 * A server-function handler as it is exported from a `?tss-serverfn-split`
 * module: the real handler body, keyed by `<export>_createServerFn_handler`.
 */
export type SplitServerFn = (opts: {
	data?: unknown;
	context?: unknown;
}) => Promise<{ result?: unknown; error?: unknown }>;

/** The `?tss-serverfn-split` module for one `functions.ts`. */
export type SplitServerFnModule = Record<string, SplitServerFn>;

// The Vite plugin splits every server function into two halves: the module a
// test imports keeps only the client stub, and the handler body is moved into a
// sibling `?tss-serverfn-split` module. Importing `functions.ts` and calling the
// export therefore runs *nothing* — it either fails on the missing Start context
// or resolves `undefined` without touching the handler. A test has to import the
// split module and call the handler through here.
//
// Both halves of that — the `?tss-serverfn-split` suffix and the Start
// AsyncLocalStorage context the handler runs inside — are TanStack internals. If
// a Start upgrade moves them, it breaks here rather than in every test.
//
// `startOptions` is left empty on purpose, so the global authentication
// middleware is *not* in the chain. What runs is the handler's own guard, which
// is what these tests are pinning: a handler must refuse an unauthorized caller
// on its own, not because something upstream happened to catch it first.
export async function callServerFn(
	module: SplitServerFnModule,
	name: string,
	data?: unknown,
	context: unknown = {},
): Promise<unknown> {
	const handler = module[`${name}_createServerFn_handler`];

	if (!handler) {
		throw new Error(
			`No handler for "${name}" in the split module. Exports: ${Object.keys(module).join(", ")}`,
		);
	}

	const { error, result } = await runWithStartContext(
		{
			getRouter: () => {
				throw new Error("A server function test must not reach the router.");
			},
			request: new Request("https://virtool.test/_serverFn/test"),
			startOptions: {},
			contextAfterGlobalMiddlewares: {},
			executedRequestMiddlewares: new Set(),
			handlerType: "serverFn",
		},
		() => handler({ data, context }),
	);

	if (error) {
		throw error;
	}

	return result;
}
