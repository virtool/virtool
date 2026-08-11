import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Node, not jsdom. Everything here runs in a one-shot Node process and
		// reads the filesystem; under jsdom its typed arrays come from a different
		// realm and identical bytes compare unequal.
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
