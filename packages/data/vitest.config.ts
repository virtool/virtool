import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "data",
		environment: "node",
		globalSetup: ["./src/db/test/globalSetup.ts"],
		include: ["src/**/*.test.ts"],
	},
});
