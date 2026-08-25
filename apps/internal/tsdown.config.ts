import { defineConfig } from "tsdown";

export default defineConfig({
	// One entry, three subcommands. `src/index.ts` dispatches on `argv[2]` and
	// dynamically imports the selected command's graph, so a single bundle serves
	// `serve`, `run` and `migrate` — the migration Job runs
	// `node dist/index.mjs migrate` at no extra Dockerfile target or CI matrix
	// entry.
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
		// unused-dependency report without a knip.json entry.
		neverBundle: ["pino", "postgres", "tar-stream"],
	},
});
