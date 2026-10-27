import { defineConfig } from "tsdown";

export default defineConfig({
	entry: { index: "src/index.ts" },
	format: ["esm"],
	platform: "node",
	target: "node24",
	outDir: "dist",
	sourcemap: true,
	dts: false,
	deps: {
		// Workspace packages ship unbuilt TypeScript, so they must be inlined.
		alwaysBundle: [/^@virtool\//],
		// bcrypt and @node-rs/argon2 load native addons relative to their own
		// install paths.
		neverBundle: ["@node-rs/argon2", "bcrypt", "pino", "postgres"],
	},
});
