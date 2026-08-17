import { defineConfig } from "tsdown";

export default defineConfig({
	// `migrate` is a second binary in the same image rather than an image of its
	// own: it needs `@virtool/data` and `postgres`, which this app already
	// bundles, so a Job running `node dist/migrate.mjs` costs no Dockerfile
	// target and no CI matrix entry.
	entry: { index: "src/index.ts", migrate: "src/migrate.ts" },
	format: ["esm"],
	platform: "node",
	target: "node24",
	outDir: "dist",
	sourcemap: true,
	dts: false,
	deps: {
		// Workspace packages ship unbuilt TypeScript, so they must be inlined —
		// that is the whole reason an app bundles. tsdown externalises everything
		// in `dependencies` by default, which would otherwise leave a `.ts` import
		// in the output that `node` cannot load.
		alwaysBundle: [/^@virtool\//],
		// Externals must appear verbatim as strings: knip's tsdown plugin reads
		// them as declared dependencies, which is what keeps them out of the
		// unused-dependency report without a knip.json entry.
		neverBundle: ["pino", "postgres", "tar-stream"],
	},
});
