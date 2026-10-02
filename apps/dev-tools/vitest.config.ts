import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "dev-tools",
		environment: "node",
		globalSetup: ["@virtool/data/db/test/globalSetup"],
		include: ["src/**/*.test.ts"],
	},
});
