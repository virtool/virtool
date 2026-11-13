// The `unit` project's environment: Node globals, with the client transform.
//
// The built-in `node` environment uses Vite's `ssr` environment, where a
// `createServerFn` keeps its handler and the server-only imports behind it.
// Client code must be tested as the browser gets it, so this environment uses
// `client`, which strips them.
import { builtinEnvironments, type Environment } from "vitest/runtime";

export default {
	...builtinEnvironments.node,
	name: "node-client",
	viteEnvironment: "client",
} satisfies Environment;
