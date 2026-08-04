import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// One instant per request, so every relative time in a document is measured
// against the same `now` and `getServerSnapshot` gets the stable value React
// requires of it. Keyed on the request rather than held in a module-level
// variable: a module-level one is set when the process imports this file, which
// on a server that has been up for days is days ago — and it would be shared by
// every concurrent render besides. A WeakMap drops the entry with the request.
const times = new WeakMap<Request, number>();

// Not factored together with `csp.ts`'s near-identical cache: the Vite plugin
// matches `createServerOnlyFn` at its definition site, and behind a factory it
// would stop treating the body as server-only.
/** The instant at which the request being served began rendering. */
export const getRequestNow: () => number = createServerOnlyFn(() => {
	const request = getRequest();

	const existing = times.get(request);
	if (existing !== undefined) {
		return existing;
	}

	const now = Date.now();
	times.set(request, now);
	return now;
});
