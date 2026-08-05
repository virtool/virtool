import { PostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Start the Postgres container every database-backed suite in the repo runs
 * against, and export its URL as `VT_POSTGRES_URL`.
 *
 * This is the only place the container is described. `@virtool/data`'s own
 * Vitest project and `apps/web`'s `server` project both name this module as
 * their `globalSetup`, so the options cannot drift apart — and because they
 * cannot, `withReuse()` hashes both runs to the same container and a local run
 * of the two suites boots one Postgres between them.
 */
export async function setup() {
	const postgres = await new PostgreSqlContainer("postgres:18")
		.withDatabase("virtool")
		.withUsername("virtool")
		.withPassword("virtool")
		.withReuse()
		.start();

	process.env.VT_POSTGRES_URL = postgres.getConnectionUri();
}

// There is deliberately no teardown. stop() would remove the container, so
// withReuse() would find nothing to match on the next run and pay a fresh boot
// every time. Clean up with `docker rm -f` when the container is no longer
// wanted.
//
// CI still pays for a container per job: `Test / Data` and `Test / Server` run
// on separate runners with no daemon between them, so there is nothing there to
// reuse. Keeping them independent is the point — a job that waited on another
// job's container would serialize the two for no wall-clock gain.
