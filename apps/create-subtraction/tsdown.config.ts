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
		// Workspace packages ship unbuilt TypeScript, so they must be inlined —
		// that is the whole reason an app bundles. tsdown externalises everything
		// in `dependencies` by default, which would otherwise leave a `.ts` import
		// in the output that `node` cannot load.
		alwaysBundle: [/^@virtool\//],
		// Externals must appear verbatim as strings: knip's tsdown plugin reads
		// them as declared dependencies, which is what keeps them out of the
		// unused-dependency report without a knip.json entry. A regular expression
		// is invisible to knip.
		//
		// The bundle imports each external at its top level, so the app must declare
		// it directly, even when only a workspace package imports it. `pino` resolves
		// its transport workers by path at run time. Everything else is inlined, so
		// the deployed `node_modules` holds only what must be real files on disk.
		neverBundle: [
			"@aws-sdk/client-s3",
			"@aws-sdk/lib-storage",
			"@azure/identity",
			"@azure/storage-blob",
			"@sentry/node",
			"execa",
			"pino",
			"tar-stream",
			"undici",
		],
	},
});
