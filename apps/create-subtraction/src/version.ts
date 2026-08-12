import pkg from "../package.json" with { type: "json" };

/**
 * This build's version, as it reaches the jobs API's claim.
 *
 * Read from the app's own manifest rather than a build-time global. `apps/web`
 * uses `__APP_VERSION__`, which is a **Vite** `define` and does not exist in a
 * bundled Node app — it would be `undefined` with nothing failing to say so. A
 * JSON import is a real module value the bundler inlines and `vitest` resolves.
 *
 * Unlike the two analysis workflows this app *is* published: CI's `publish-ghcr`
 * job runs `pnpm -C apps/create-subtraction version` before the Docker build, so
 * a released image carries a real version here. It takes no workflow cache, so
 * nothing but the claim record reads it.
 */
export const APP_VERSION: string = pkg.version;
