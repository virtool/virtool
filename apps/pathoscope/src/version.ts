import pkg from "../package.json" with { type: "json" };

/**
 * This build's version, as it reaches the jobs API's claim and the cache keys.
 *
 * Read from the app's own manifest rather than a build-time global.
 * `apps/web` uses `__APP_VERSION__`, which is a **Vite** `define` and does not
 * exist in a bundled Node app — it would be `undefined` with nothing failing to
 * say so. A JSON import is a real module value the bundler inlines and `vitest`
 * resolves.
 *
 * **In a built image today this is `0.0.0`, and that is a live constraint on the
 * cache.** CI's `publish-ghcr` job runs `pnpm -C <workspace> version` before the
 * Docker build, and this app has no publish entry on purpose —
 * `virtool/workflow-pathoscope` still releases the pathoscope image and a second
 * pipeline shipping one would leave two candidates for what the cluster runs.
 * `workflow_version` is part of every cache key, so until this app is published
 * with a real version its `reference_mapping_index` and
 * `subtraction_mapping_index` keys cannot coincide with any Python run's and the
 * two implementations share nothing. The derivation is still exact — that is
 * what the tests pin — but the sharing only starts at cutover.
 */
export const APP_VERSION: string = pkg.version;
