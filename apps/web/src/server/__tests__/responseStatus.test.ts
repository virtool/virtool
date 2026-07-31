/// <reference types="vite/client" />
// The server tsconfig carries Node types, not Vite's, so `import.meta.glob` —
// used below to read every functions.ts as source — needs the reference.

import { describe, expect, it } from "vitest";

// 204, 205, and 304 are the null-body statuses: the fetch spec forbids a
// response carrying a body on any of them, and undici enforces it in the
// `Response` constructor.
//
// A server function can never answer with one. Start's server-function handler
// always serializes a body — the value it serializes is the `{ result, error }`
// wrapper, which is never `undefined`, so the `new Response(undefined, ...)`
// branch is unreachable from an RPC call. Setting a null-body status therefore
// makes the constructor throw *after* the handler has already done its work,
// and the handler's own catch rebuilds the error response with the same status
// still set, so it throws a second time with nothing left to catch it. The
// caller sees a failed request for an operation that succeeded.
//
// Deletions return `null` and answer 200. The status is invisible to the RPC
// client either way — it deserializes the body and never reads the code.
const NULL_BODY_STATUSES = [204, 205, 304];

const SOURCES = import.meta.glob("../**/functions.ts", {
	eager: true,
	query: "?raw",
	import: "default",
}) as Record<string, string>;

describe("server functions", () => {
	// A glob that matched nothing, or that stopped yielding source text, would
	// make every scan below pass while asserting nothing. Naming known modules
	// pins the pattern without pinning how many features the server has.
	it("reads every functions.ts as source", () => {
		expect(Object.keys(SOURCES)).toEqual(
			expect.arrayContaining([
				"../groups/functions.ts",
				"../samples/functions.ts",
				"../uploads/functions.ts",
			]),
		);

		for (const [path, source] of Object.entries(SOURCES)) {
			expect(typeof source, `${path} did not load as source text`).toBe(
				"string",
			);
		}
	});

	it.each(NULL_BODY_STATUSES)(
		"never answer with the null-body status %i",
		(status) => {
			const pattern = new RegExp(`setResponseStatus\\(\\s*${status}\\b`);

			const offenders = Object.entries(SOURCES)
				.filter(([, source]) => pattern.test(source))
				.map(([path]) => path)
				.sort();

			expect(offenders).toEqual([]);
		},
	);
});
