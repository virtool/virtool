import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

export default defineConfig(({ command, mode }) => ({
	build: {
		sourcemap: true,
		rolldownOptions: {
			output: {
				advancedChunks: {
					// Rolldown assigns a module to a group by `test`, not by how the
					// module is reached, so a group matching all of `@sentry/` would
					// capture Replay into the eager chunk even though `scheduleReplay`
					// only ever reaches it through a dynamic import. Replay needs its own
					// group, at a higher priority than the catch-all, to land in a chunk
					// of its own. Higher priority wins; array order does not decide.
					// The `replay` pattern deliberately also matches `@sentry/replay-canvas`.
					groups: [
						{
							name: "sentry-replay",
							test: /node_modules[\\/]@sentry[\\/]replay/,
							priority: 20,
							// A captured module normally drags its dependencies into the
							// group with it. Replay depends on `@sentry/core`, which the
							// eager `sentry` chunk needs too — so recursive capture pulls
							// core into this chunk and the eager chunk then imports it back
							// *statically*, undoing the deferral. Keep the group to the
							// modules its `test` actually matches.
							includeDependenciesRecursively: false,
						},
						{
							name: "sentry",
							test: /node_modules[\\/]@sentry[\\/]/,
							priority: 10,
						},
					],
				},
			},
		},
	},
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	environments: {
		ssr: {
			resolve: {
				// `bcrypt` loads its prebuilt binary through
				// `node-gyp-build(path.resolve(__dirname))`. Bundled, that `__dirname`
				// has no value in ES module scope and the first import of the module
				// throws, taking the whole auth path down with it.
				//
				// Nitro already knows `bcrypt` is native and traces it out of its own
				// bundle — but it bundles the server in two stages and cannot reclaim
				// what the Vite stage inlined first, so the import has to survive this
				// stage untouched. That in turn is why `bcrypt` is a dependency of this
				// app: Nitro resolves the external from the app root, and pnpm does not
				// hoist a package reached only through `@virtool/data`.
				external: ["bcrypt"],
			},
		},
	},
	envPrefix: ["VITE_", "VT_"],
	resolve: {
		alias: {
			"@": path.resolve("src"),
			"@account": path.resolve("src/account"),
			"@administration": path.resolve("src/administration"),
			"@analyses": path.resolve("src/analyses"),
			"@app": path.resolve("src/app"),
			"@banner": path.resolve("src/banner"),
			"@base": path.resolve("src/base"),
			"@forms": path.resolve("src/forms"),
			"@groups": path.resolve("src/groups"),
			"@hmm": path.resolve("src/hmm"),
			"@indexes": path.resolve("src/indexes"),
			"@jobs": path.resolve("src/jobs"),
			"@labels": path.resolve("src/labels"),
			"@nav": path.resolve("src/nav"),
			"@otus": path.resolve("src/otus"),
			"@quality": path.resolve("src/quality"),
			"@references": path.resolve("src/references"),
			"@samples": path.resolve("src/samples"),
			"@sequences": path.resolve("src/sequences"),
			"@server": path.resolve("src/server"),
			"@subtraction": path.resolve("src/subtraction"),
			"@tasks": path.resolve("src/tasks"),
			"@tests": path.resolve("src/tests"),
			"@uploads": path.resolve("src/uploads"),
			"@users": path.resolve("src/users"),
			"@wall": path.resolve("src/wall"),
		},
	},
	plugins: [
		tanstackStart({
			router: {
				autoCodeSplitting: true,
			},
		}),
		// Tests never ask Nitro to serve anything, and it holds file handles open
		// that stall Vitest's shutdown for ten seconds after the last test passes.
		mode !== "test" &&
			nitro({
				// `@sentry/profiling-node` ships native `.node` addons the bundler can't
				// inline, and Nitro's builtin native-package list does not cover it.
				// Tracing it (and its native helper) keeps the packages external and
				// copies them into the server output, so the build doesn't choke on the
				// binaries and the runtime import resolves. The dist image ships only
				// `.output`, so the trace is what makes the package available at runtime.
				traceDeps: ["@sentry/profiling-node*", "@sentry/node-cpu-profiler*"],
			}),
		react(),
		// The React Compiler is a Babel plugin; oxc has no native equivalent yet.
		// Tests skip it: per-transform overhead that thrashes CPU across parallel
		// worktrees. CI sets `VT_TEST_REACT_COMPILER=1` to keep its footguns tested.
		(mode !== "test" || process.env.VT_TEST_REACT_COMPILER === "1") &&
			babel({
				presets: [reactCompilerPreset()],
			}),
		tailwindcss(),
		// Build only: uploads source maps and adds route/middleware
		// instrumentation. Kept out of dev/test so Sentry never loads there. Must
		// come last.
		command === "build" &&
			sentryTanstackStart({
				org: "cfia-virtool",
				project: "cloud-ui",
				authToken: process.env.SENTRY_AUTH_TOKEN,
			}),
	],
	optimizeDeps: {
		// The `tanstackStart` plugin points the client scanner at `client.tsx` and
		// `router.tsx`, so a cold-start scan reaches every used dependency in one
		// pass ("the scanner found every used dependency"). That is the condition
		// under which releasing the first optimize early is safe — with it,
		// nothing is discovered late to trigger a reoptimize and a full page
		// reload. It stops being safe if the scan is starved again, e.g. by
		// warming test files (see the `warmup` note below).
		holdUntilCrawlEnd: false,
		include: [
			"@hookform/resolvers/zod",
			"@tanstack/react-query",
			"@tanstack/react-router",
			"@tanstack/react-virtual",
			"class-variance-authority",
			"clsx",
			"d3",
			"downshift",
			"es-toolkit",
			"es-toolkit/array",
			"es-toolkit/compat",
			"es-toolkit/math",
			"es-toolkit/object",
			"es-toolkit/string",
			"fuse.js",
			"lucide-react",
			"radix-ui",
			"react-dropzone",
			"react-hook-form",
			"tailwind-merge",
			"zod",
			"zod/v4",
			"zustand",
			"zustand/middleware",
		],
	},
	server: {
		allowedHosts: ["virtool.local"],
		warmup: {
			// Pre-transform the app shell so the first navigation is warm. The `!`
			// patterns keep the globs off `__tests__` files — those import
			// `@tests/setup` (vitest, faker) and testing-library, and warming
			// them registers those test-only packages as client optimize deps,
			// forcing a reoptimize and a full page reload on cold start.
			clientFiles: [
				"./src/routes/__root.tsx",
				"./src/routes/_authenticated.tsx",
				"./src/app/**/*.{ts,tsx}",
				"./src/base/**/*.{ts,tsx}",
				"./src/nav/**/*.{ts,tsx}",
				"!./src/**/__tests__/**",
				"!./src/**/*.test.{ts,tsx}",
			],
		},
	},
}));
