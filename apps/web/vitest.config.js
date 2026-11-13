import os from "node:os";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import viteConfigFn from "./vite.config.js";

// `mode: "test"` drops Nitro and `command: "serve"` drops Sentry, so neither is
// ever constructed here and the plugin list needs no further filtering.
const viteConfig = viteConfigFn({ command: "serve", mode: "test" });

// Client tests must never reach Postgres. `@server/composition` opens the pool,
// and `@server/config` holds the settings it reads. If the client transform
// lets either into a `unit`, `web`, or `shots` test, the guard throws, so
// Docker cannot become a prerequisite again without notice.
// `@virtool/data/db/pg` opens nothing at import, but a client module that
// reaches the data layer's pool constructor is the same bug one step earlier.
// These aliases come before the `@server` prefix alias, so they win.
const postgresGuardAlias = {
	find: /^(@server\/(config|composition)|@virtool\/data\/db\/pg)$/,
	replacement: path.resolve("src/tests/postgresGuard.ts"),
};

/**
 * Return the Chromium options for a project. Each call builds new objects,
 * because Vitest writes the project name into each instance.
 */
function createBrowserOptions() {
	return {
		enabled: true,
		provider: playwright({ contextOptions: { timezoneId: "UTC" } }),
		headless: true,
		// At the default 414 px width, the navigation hides the account sections.
		instances: [
			{ browser: "chromium", viewport: { width: 1280, height: 800 } },
		],
		// A failed assertion already names the element and the difference; a
		// screenshot adds nothing and writes a PNG into the source tree.
		screenshotFailures: false,
	};
}

export default defineConfig({
	...viteConfig,
	optimizeDeps: {
		...viteConfig.optimizeDeps,
		// Only tests import these. When the Chromium projects find them late, Vite
		// reloads the page part way through the run and breaks the open suites.
		include: [
			...(viteConfig.optimizeDeps?.include ?? []),
			"axe-core",
			"react-dom/server",
		],
	},
	test: {
		globals: true,
		silent: false,
		// Per-process worker count. Several worktrees testing at once each spawn
		// this many workers and collectively oversubscribe the machine; set
		// `VT_TEST_WORKERS` to dial it down when running them in parallel.
		maxWorkers: process.env.VT_TEST_WORKERS
			? Number(process.env.VT_TEST_WORKERS)
			: Math.max(1, Math.floor(os.cpus().length / 2)),
		projects: [
			{
				extends: true,
				test: {
					// The file extension picks the project: a client `.test.ts` file
					// runs here on Node and must not touch a DOM or browser global. A
					// test that needs one is a `.test.tsx` file. There is no setup
					// file, so a test that needs a server-function mock calls
					// `vi.mock` itself.
					name: "unit",
					environment: "./src/tests/nodeClientEnvironment.ts",
					include: ["src/**/*.test.ts"],
					exclude: ["src/server/**"],
					alias: [postgresGuardAlias],
				},
			},
			{
				extends: true,
				test: {
					// No globalSetup: the client transform removes server function
					// bodies and the server-only imports behind them, so nothing here
					// reaches Postgres. Component tests must not need Docker.
					name: "web",
					// A full-route `renderRoute` test (router load, the whole route
					// tree, and the React Compiler Babel pass) is the heaviest test in
					// the suite. When CI runs a worker per core, the shared CPU can push
					// one past the 5 s default. This limit gives headroom and still
					// fails a hang quickly.
					testTimeout: 15_000,
					setupFiles: ["./src/tests/setupBrowser.ts"],
					include: ["src/**/*.test.tsx"],
					alias: [postgresGuardAlias],
					browser: createBrowserOptions(),
				},
			},
			{
				extends: true,
				test: {
					// Server code runs on Node in production and must be tested there.
					name: "server",
					environment: "node",
					// The Postgres container is described once, in the package that
					// owns the schema, and this project and `@virtool/data`'s both
					// name that module. One definition means one `withReuse()` hash,
					// so a local run of the two suites boots a single Postgres.
					globalSetup: ["@virtool/data/db/test/globalSetup"],
					// `src/server/config.ts` parses the environment when it is
					// imported, so these have to be satisfiable for any test that
					// reaches a server module. Server tests exercise storage through
					// MemoryStorage and never reach a real bucket.
					env: {
						VT_STORAGE_BACKEND: "s3",
						VT_STORAGE_S3_BUCKET: "virtool-test",
						VT_PUBLIC_ORIGIN: "http://localhost:5173",
						VT_AUTH_SECRET: "test-auth-secret-test-auth-secret",
					},
					include: ["src/server/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					// `*.shot.tsx` files render a route or component against the same
					// fakes and server-function mocks as the `web` tests, then save a
					// PNG. They need no Postgres, vtd environment, or dev server.
					name: "shots",
					setupFiles: ["./src/tests/setupShots.ts"],
					include: ["src/**/*.shot.tsx"],
					alias: [postgresGuardAlias],
					browser: {
						...createBrowserOptions(),
						screenshotDirectory: path.resolve("screenshots"),
					},
				},
			},
		],
	},
});
