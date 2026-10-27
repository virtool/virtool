import pkg from "../package.json" with { type: "json" };

/**
 * This build's version, as it reaches the `virtool_app_info` gauge.
 *
 * Read from the app's own manifest rather than from a build-time global.
 * `apps/web` uses `__APP_VERSION__`, which is a **Vite** `define` and simply
 * does not exist in a bundled Node app — the gauge label would render
 * `undefined` with nothing failing to say so. A JSON import is a real module
 * value: the bundler inlines it, `vitest` resolves it, and the version is then
 * passed explicitly into `createMetrics` rather than read from ambient scope.
 *
 * `changeset version` writes each release's version into the manifest, and
 * CI's `release-ghcr` job builds from that release's tag. Builds between
 * releases carry the last released version.
 */
export const APP_VERSION: string = pkg.version;
