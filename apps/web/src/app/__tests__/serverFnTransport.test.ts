import { Buffer } from "node:buffer";
import { once } from "node:events";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { findAnalysesFn } from "@server/analyses/functions";
import {
	findGroupsFn,
	getGroupFn,
	listGroupsFn,
} from "@server/groups/functions";
import { findHmmsFn } from "@server/hmm/functions";
import { getJobsFn } from "@server/jobs/functions";
import { findLabelsFn } from "@server/labels/functions";
import { findOtusFn } from "@server/otus/functions";
import { findReferencesFn } from "@server/references/functions";
import { findSamplesFn } from "@server/samples/functions";
import { findSubtractionsFn } from "@server/subtraction/functions";
import { getTasksFn } from "@server/tasks/functions";
import { findUsersFn, searchUsersFn } from "@server/users/functions";
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { runWithStartContext } from "@tanstack/start-storage-context";
import { fromJSON, toCrossJSONAsync } from "seroval";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// Exercise Vite's generated browser RPCs instead of the component-test stubs.
vi.hoisted(() => vi.resetModules());

vi.unmock("@server/analyses/functions");
vi.unmock("@server/groups/functions");
vi.unmock("@server/hmm/functions");
vi.unmock("@server/jobs/functions");
vi.unmock("@server/labels/functions");
vi.unmock("@server/otus/functions");
vi.unmock("@server/references/functions");
vi.unmock("@server/samples/functions");
vi.unmock("@server/subtraction/functions");
vi.unmock("@server/tasks/functions");
vi.unmock("@server/users/functions");

type ReceivedRequest = {
	method: string | undefined;
	url: string;
	headers: IncomingHttpHeaders;
	wire: unknown;
	payload: unknown;
};

const requests: ReceivedRequest[] = [];
const result = {
	items: [],
	totalCount: 0,
	fetchedAt: new Date("2026-09-08T12:00:00Z"),
};

// A loopback HTTP peer checks the actual bytes emitted by the generated client.
// Server policies and validators are exercised separately in server tests.
const server = createServer(async (request, response) => {
	try {
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		const url = request.url ?? "/";
		const body = Buffer.concat(chunks).toString();
		const serialized =
			body || new URL(url, "http://localhost").searchParams.get("payload");
		const wire = serialized ? JSON.parse(serialized) : undefined;
		requests.push({
			method: request.method,
			url,
			headers: request.headers,
			wire,
			payload: wire ? fromJSON(wire) : undefined,
		});
		response.writeHead(200, {
			"content-type": "application/json",
			"x-tss-serialized": "true",
		});
		response.end(JSON.stringify(await toCrossJSONAsync({ result })));
	} catch (error) {
		response.writeHead(500, { "content-type": "text/plain" });
		response.end(String(error));
	}
});

let origin: string;

beforeAll(async () => {
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Expected a TCP listener");
	}
	origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
});

beforeEach(() => {
	requests.length = 0;
});

async function transportFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	const url = input instanceof Request ? input.url : String(input);
	return fetch(new URL(url, origin), init);
}

// The external Start runtime resolves its options through Node under jsdom.
function withStartContext<T>(call: () => Promise<T>): Promise<T> {
	return runWithStartContext(
		{
			getRouter: () => {
				throw new Error("An HTTP client test must not reach the router");
			},
			request: new Request("http://localhost/_serverFn/test"),
			startOptions: {},
			contextAfterGlobalMiddlewares: {},
			executedRequestMiddlewares: new Set(),
			handlerType: "serverFn",
		},
		call,
	);
}

const term = "病毒 café 🧬 + & ? # / % = \"quoted\" 'single' \\ newline\n";
const ids = Array.from({ length: 100 }, (_, index) => index + 1);
const samples = {
	term,
	page: 2,
	perPage: 100,
	labels: ids,
	users: ids,
	groups: ids,
	workflows: ["pathoscope:ready", "nuvs:none"],
	createdAfter: "2026-01-01",
	createdBefore: "2026-09-08",
	sort: "name",
	direction: "ascending",
} as const;
const analyses = {
	sampleId: 1,
	userIds: ids,
	workflows: ["pathoscope", "nuvs"],
	page: 2,
	perPage: 100,
	sort: "createdAt",
	direction: "descending",
} as const;

const cases = [
	{
		name: "findSamplesFn",
		data: samples,
		call: () =>
			findSamplesFn({
				data: { ...samples, workflows: [...samples.workflows] },
				fetch: transportFetch,
			}),
	},
	{
		name: "findAnalysesFn",
		data: analyses,
		call: () =>
			findAnalysesFn({
				data: { ...analyses, workflows: [...analyses.workflows] },
				fetch: transportFetch,
			}),
	},
	{
		name: "getJobsFn",
		data: { jobIds: ids },
		call: () => getJobsFn({ data: { jobIds: ids }, fetch: transportFetch }),
	},
	{
		name: "getTasksFn",
		data: { taskIds: ids },
		call: () => getTasksFn({ data: { taskIds: ids }, fetch: transportFetch }),
	},
	{
		name: "findUsersFn",
		data: { term, administrator: true, active: false },
		call: () =>
			findUsersFn({
				data: { term, administrator: true, active: false },
				fetch: transportFetch,
			}),
	},
	{
		name: "searchUsersFn",
		data: { term },
		call: () => searchUsersFn({ data: { term }, fetch: transportFetch }),
	},
	{
		name: "findReferencesFn",
		data: { term, archived: true },
		call: () =>
			findReferencesFn({
				data: { term, archived: true },
				fetch: transportFetch,
			}),
	},
	{
		name: "findOtusFn",
		data: { referenceId: 1, term },
		call: () =>
			findOtusFn({ data: { referenceId: 1, term }, fetch: transportFetch }),
	},
	{
		name: "findHmmsFn",
		data: { term },
		call: () => findHmmsFn({ data: { term }, fetch: transportFetch }),
	},
	{
		name: "findSubtractionsFn",
		data: { term },
		call: () => findSubtractionsFn({ data: { term }, fetch: transportFetch }),
	},
	{
		name: "findGroupsFn",
		data: { term },
		call: () => findGroupsFn({ data: { term }, fetch: transportFetch }),
	},
	{
		name: "findLabelsFn",
		data: { term },
		call: () => findLabelsFn({ data: { term }, fetch: transportFetch }),
	},
];

describe("generated search and batch HTTP transport", () => {
	it.each(cases)(
		"$name sends its input in a POST body",
		async ({ data, call }) => {
			expect(await withStartContext<unknown>(call)).toEqual(result);
			expect(requests).toHaveLength(1);
			const request = requests[0];
			if (!request) {
				throw new Error("Expected an HTTP request");
			}
			expect(request.method).toBe("POST");
			expect(new URL(request.url, origin).search).toBe("");
			expect(request.headers["content-type"]).toBe("application/json");
			expect(request.headers["x-tsr-serverfn"]).toBe("true");
			expect(request.wire).not.toEqual({ data });
			expect(request.payload).toEqual({ data });
		},
	);

	it("keeps simple lookups and no-input reads on GET", async () => {
		await withStartContext(() =>
			getGroupFn({ data: { groupId: 1 }, fetch: transportFetch }),
		);
		await withStartContext(() => listGroupsFn({ fetch: transportFetch }));
		expect(requests.map(({ method }) => method)).toEqual(["GET", "GET"]);
		expect(requests[0]?.payload).toEqual({ data: { groupId: 1 } });
		expect(requests[1]?.payload).toBeUndefined();
	});

	it("reuses a prefetched POST query after hydration and refetches on invalidation", async () => {
		const options = {
			queryKey: ["groups", "search", term],
			queryFn: () =>
				withStartContext(() =>
					findGroupsFn({ data: { term }, fetch: transportFetch }),
				),
			staleTime: Infinity,
		};
		const preloader = new QueryClient();
		const client = new QueryClient();
		try {
			await preloader.prefetchQuery(options);
			hydrate(client, dehydrate(preloader));
			expect(await client.ensureQueryData(options)).toEqual(result);
			expect(requests).toHaveLength(1);
			await client.invalidateQueries({ queryKey: options.queryKey });
			expect(await client.fetchQuery(options)).toEqual(result);
			expect(requests).toHaveLength(2);
			expect(requests.every(({ method }) => method === "POST")).toBe(true);
		} finally {
			preloader.clear();
			client.clear();
		}
	});
});
