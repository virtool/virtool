import pkg from "../package.json" with { type: "json" };

/**
 * This build's version, as it reaches the `virtool_app_info` gauge.
 *
 * Read from the app's own manifest rather than from a build-time global.
 * `apps/web` uses `__APP_VERSION__`, which is a **Vite** `define` and simply
 * does not exist in a bundled Node app — the gauge label would render
 * `undefined` with nothing failing to say so. A JSON import is a real module
 * value: the bundler inlines it, `vitest` resolves it, and the version is then
 * passed explicitly into `bootstrap` rather than read from ambient scope.
 *
 * It is only *correct* in a released image because CI's `publish-ghcr` job runs
 * `pnpm -C ${{ matrix.workspace }} version` before the Docker build. That step
 * is driven by the publish matrix, so this app is covered by its matrix entry —
 * remove the entry and every image still builds while this silently reverts to
 * `0.0.0`.
 */
export const APP_VERSION: string = pkg.version;
