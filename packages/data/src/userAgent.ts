/**
 * How Virtool identifies itself to the third parties it calls.
 *
 * NCBI asks that automated callers say who they are and throttles or blocks
 * anonymous traffic; GitHub refuses a request carrying no `User-Agent` at all.
 * There is no shared HTTP client here — each call site takes its own deadline,
 * which works — so the header travels as this constant instead.
 *
 * **It carries no version.** Carrying one would mean threading a string through
 * every function between an app's entrypoint and its `fetch`: `packages/data`
 * has no build-time global to read one from, `apps/web` having
 * `__APP_VERSION__` and `apps/tasks` a JSON import of its own manifest, neither
 * of which is visible here. A bare product token is what NCBI and GitHub ask
 * for, and one token every outbound request agrees on is worth more than a
 * version on the subset of call sites that could reach one.
 */
export const USER_AGENT = "virtool";
