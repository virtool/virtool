/**
 * The workflow test harness, exported as `@virtool/workflow/testing`.
 *
 * Every workflow app uses it. Three rules govern the harness:
 *
 * - **Everything is a factory function.** Nothing is installed by importing this
 *   module, and there is no module-level mutable state — Vitest runs test files
 *   in parallel processes and tests within a file concurrently on request, so
 *   shared module state is a cross-test data race.
 * - **Anything needing cleanup returns its disposer**, for the caller to register
 *   with `onTestFinished`. There is no global `beforeEach`.
 * - **Nothing here imports from `apps/web`**.
 *
 * Composition is explicit. A test calls each factory it needs and wires them
 * together, and a key that a seeding helper returns goes on the fake row:
 *
 * @example
 * const sample = createFakeSample();
 * const { storage, seedSampleReads } = createTestStorage();
 *
 * const seeded = await seedSampleReads(sample.id, [
 * 	{ name: "reads_1.fq.gz", contents: "ACGT" },
 * ]);
 *
 * const state = createJobsApiState({
 * 	samples: new Map([
 * 		[
 * 			sample.id,
 * 			{
 * 				...sample,
 * 				reads: seeded.map((file, id) => ({
 * 					id,
 * 					name: file.name,
 * 					size: file.size,
 * 					storageKey: file.storageKey,
 * 				})),
 * 			},
 * 		],
 * 	]),
 * });
 *
 * const client = createFakeJobsApiClient(state);
 * const { path, cleanup } = await createTestWorkPath(["reads"]);
 *
 * onTestFinished(cleanup);
 */

export * from "./builders";
export * from "./checksum";
export * from "./context";
export * from "./gzip";
export * from "./http";
export * from "./jobsApi/fake";
export * from "./jobsApi/routes";
export * from "./jobsApi/server";
export * from "./jobsApi/state";
export * from "./logger";
export * from "./random";
export * from "./storage";
export * from "./subprocess";
export * from "./workPath";
