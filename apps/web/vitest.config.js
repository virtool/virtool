import os from "node:os";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import viteConfigFn from "./vite.config.js";

// `mode: "test"` drops Nitro and `command: "serve"` drops Sentry, so neither is
// ever constructed here and the plugin list needs no further filtering.
const viteConfig = viteConfigFn({ command: "serve", mode: "test" });

// Pins the assumption that client tests never reach Postgres.
// `@server/composition` is where the pool is opened, and `@server/config` is
// what it reads to do so; if either survives the client transform into the
// browser program, the guard throws instead of quietly making Docker a
// prerequisite again. `@virtool/data/db/pg` is listed too — it opens nothing at
// import any more, but a browser module reaching the data layer's pool
// constructor is the same bug one step earlier. Listed before the `@server`
// prefix alias so they win.
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
					// No globalSetup: the client transform strips server function bodies
					// and the server-only imports behind them, so nothing here reaches
					// Postgres. Component tests must not need Docker.
					name: "web",
					// A full-route `renderRoute` test (router load + the whole route
					// tree + the React Compiler Babel pass) is the heaviest thing the
					// suite does. When CI runs a worker per core, the shared CPU pushes
					// these past the 5s default and they time out — masquerading as a
					// flake. Give them headroom while still failing a genuine hang fast.
					testTimeout: 15_000,
					setupFiles: ["./src/tests/setupBrowser.ts"],
					include: ["src/**/*.test.tsx"],
					// `*.a11y.test.tsx` files run in the `a11y` project below.
					exclude: ["src/**/*.a11y.test.tsx"],
					alias: [postgresGuardAlias],
					browser: createBrowserOptions(),
				},
			},
			{
				extends: true,
				test: {
					// Server code runs on Node in production and must be tested there.
					// Under jsdom its typed arrays come from a different realm, so bytes
					// read back from storage compare unequal to the bytes written.
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
					// axe-core's `color-contrast` rule — and every check that depends on
					// computed layout or visibility — needs a real layout engine, which
					// jsdom does not have. This project runs the opt-in `*.a11y.test.tsx`
					// files in headless Chromium through Playwright so those rules can
					// actually run.
					name: "a11y",
					// `setup.tsx` wires in the global server-function mocks and
					// jsdom-oriented providers these tests never need, so the browser
					// project gets its own lean setup that only loads the app stylesheet
					// — without it, Tailwind classes resolve to no colour and contrast
					// checks are meaningless.
					setupFiles: ["./src/tests/setupA11y.ts"],
					include: ["src/**/*.a11y.test.{ts,tsx}"],
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: "chromium" }],
						// A failing axe assertion already reports the rule, the offending
						// node, and the exact contrast ratio; a screenshot adds nothing and
						// writes a PNG into the source tree on every failure.
						screenshotFailures: false,
					},
				},
			},
			{
				extends: true,
				test: {
					// `*.shot.tsx` files render a route or component against the same
					// fakes and server-function mocks as the jsdom tests, then save a
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
