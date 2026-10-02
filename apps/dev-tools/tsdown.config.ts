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
		// bcrypt loads a native addon relative to its own install path.
		neverBundle: ["bcrypt", "pino", "postgres"],
	},
});
