/**
 * The workflow test harness, exported as `@virtool/workflow/testing`.
 *
 * It replaces Python's `virtool/workflow/pytest_plugin/` and
 * `tests/fixtures/workflow_api/`, and it is what every workflow app's tests
 * stand on. Three rules hold it together:
 *
 * - **Everything is a factory function.** Nothing is installed by importing this
 *   module, and there is no module-level mutable state — Vitest runs test files
 *   in parallel processes and tests within a file concurrently on request, so
 *   shared module state is a cross-test data race.
 * - **Anything needing cleanup returns its disposer**, for the caller to register
 *   with `onTestFinished`. There is no global `beforeEach`.
 * - **Nothing here imports from `apps/web`**, so a workflow app's tests can use
 *   it without depending on the SPA.
 */

export * from "./builders";
export * from "./checksum";
export * from "./context";
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
