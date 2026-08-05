import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "jobs-api",
		environment: "node",
		// The Postgres container is described once, in the package that owns the
		// schema, and `@virtool/data`'s own project and `apps/web`'s `server`
		// project both name that same module. One definition means one
		// `withReuse()` hash, so a local run of all three suites boots a single
		// Postgres between them.
		globalSetup: ["@virtool/data/db/test/globalSetup"],
		include: ["src/**/*.test.ts"],
	},
});
