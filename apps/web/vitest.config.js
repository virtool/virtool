import os from "node:os";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import viteConfigFn from "./vite.config";

// `mode: "test"` drops Nitro and `command: "serve"` drops Sentry, so neither is
// ever constructed here and the plugin list needs no further filtering.
const viteConfig = viteConfigFn({ command: "serve", mode: "test" });

export default defineConfig({
	...viteConfig,
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
					// No globalSetup: the client transform strips server function bodies
					// and the server-only imports behind them, so nothing here reaches
					// Postgres. Component tests must not need Docker.
					name: "web",
					environment: "jsdom",
					// A full-route `renderRoute` test (router load + the whole route
					// tree + the React Compiler Babel pass) is the heaviest thing the
					// suite does. When CI runs a worker per core, the shared CPU pushes
					// these past the 5s default and they time out — masquerading as a
					// flake. Give them headroom while still failing a genuine hang fast.
					testTimeout: 15_000,
					setupFiles: ["./src/tests/setup.tsx"],
					include: ["src/**/*.test.{ts,tsx}"],
					// `*.a11y.test.tsx` files run in the browser `a11y` project below,
					// under a real layout engine. The glob here would otherwise also
					// match them and run them a second time under jsdom, where the
					// colour-contrast checks they exist for cannot run.
					exclude: ["src/server/**", "src/**/*.a11y.test.{ts,tsx}"],
					// Pin the assumption above. `@server/composition` is where the pool
					// is opened, and `@server/config` is what it reads to do so; if
					// either survives the client transform into the browser program, the
					// guard throws instead of quietly making Docker a prerequisite
					// again. `@virtool/data/db/pg` is listed too — it opens nothing at
					// import any more, but a browser module reaching the data layer's
					// pool constructor is the same bug one step earlier. Listed before
					// the `@server` prefix alias so they win.
					alias: [
						{
							find: /^(@server\/(config|composition)|@virtool\/data\/db\/pg)$/,
							replacement: path.resolve("src/tests/postgresGuard.ts"),
						},
					],
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
					globalSetup: ["./src/tests/globalSetup.ts"],
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
					// actually run (VIR-2693 / VIR-2746).
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
		],
	},
});
