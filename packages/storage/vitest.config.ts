import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					// Everything that can be tested against MemoryStorage. No Docker,
					// so this stays the fast loop.
					name: "unit",
					environment: "node",
					include: ["src/**/*.test.ts"],
					exclude: ["src/integration.test.ts"],
				},
			},
			{
				test: {
					// The backends against the same services Python tests with: Garage
					// for S3 and Azurite for Azure Blob.
					name: "integration",
					environment: "node",
					globalSetup: ["./src/test/globalSetup.ts"],
					include: ["src/integration.test.ts"],
					// Garage has to lay out a cluster before it serves any S3 traffic.
					testTimeout: 30_000,
					hookTimeout: 120_000,
				},
			},
		],
	},
});
