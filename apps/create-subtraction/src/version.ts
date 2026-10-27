import pkg from "../package.json" with { type: "json" };

/**
 * This build's version, as it reaches the jobs API's claim.
 *
 * Read from the app's own manifest rather than a build-time global. `apps/web`
 * uses `__APP_VERSION__`, which is a **Vite** `define` and does not exist in a
 * bundled Node app — it would be `undefined` with nothing failing to say so. A
 * JSON import is a real module value the bundler inlines and `vitest` resolves.
 *
 * `changeset version` writes each release's version into the manifest, and
 * CI's `release-ghcr` job builds from that release's tag. It takes
 * no workflow cache, so nothing but the claim record reads it.
 */
export const APP_VERSION: string = pkg.version;
