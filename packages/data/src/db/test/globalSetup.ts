import { PostgreSqlContainer } from "@testcontainers/postgresql";

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
// The options above match `apps/web/src/tests/globalSetup.ts` byte for byte, so
// withReuse() hashes to the same container and a local run of both suites boots
// one. CI runs them as separate jobs and so pays for two, until VIR-2868
// collapses them back.
