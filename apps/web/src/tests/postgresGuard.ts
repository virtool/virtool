// Reaching this module means a client-reachable file imported a server module
// that opens Postgres. The `web` Vitest project aliases `@server/composition`
// (which builds the pool), `@server/config` (which it reads to do so), and
// `@virtool/data/db/pg` (which exposes the constructor) here, so such an import
// fails loudly instead of silently dragging a database — and a Docker daemon —
// back into the component tests.
//
// Server functions are fine to import from client code: the client transform
// strips the `createServerFn` handler and the server-only imports behind it, so
// nothing here resolves. An import that survives the transform is the bug.
throw new Error(
	"a server module that reaches Postgres was imported into the browser test program. " +
		"Keep Postgres behind a createServerFn handler so the client transform can strip it.",
);
