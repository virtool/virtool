import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "tasks",
		environment: "node",
		// The Postgres container is described once, in the package that owns the
		// schema, and `@virtool/data`'s own project, `apps/web`'s `server` project
		// and `apps/jobs-api` all name that same module. One definition means one
		// `withReuse()` hash, so a local run of every database-backed suite boots a
		// single Postgres between them.
		globalSetup: ["@virtool/data/db/test/globalSetup"],
		include: ["src/**/*.test.ts"],
	},
});
