import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";

/** A request the test server received, with its body already read. */
export type RecordedRequest = {
	method: string;
	/** The path alone, so an assertion cannot pass on a prefixed URL. */
	path: string;
	searchParams: URLSearchParams;
	headers: Record<string, string | string[] | undefined>;
	body: string;
	/** The body parsed as JSON. `undefined` when there was none or it was not JSON. */
	json: unknown;
};

/**
 * Answers one request.
 *
 * Leave the response alone to hang it, or call `response.destroy()` to produce
 * a genuine transport failure mid-connection.
 */
export type TestServerHandler = (
	request: RecordedRequest,
	response: ServerResponse,
) => void;

/** An embedded jobs API stand-in. */
export type TestServer = {
	baseUrl: string;
	/** Every request received, in order. */
	requests: RecordedRequest[];
	close: () => Promise<void>;
};

/**
 * Start a real HTTP server for the jobs API client to talk to.
 *
 * Retry, cancellation and status-to-error mapping all live in the space between
 * `fetch` and the wire, which is exactly what a fetch mock would assert into
 * existence rather than test.
 */
export async function startTestServer(
	handler: TestServerHandler,
): Promise<TestServer> {
	const requests: RecordedRequest[] = [];
	const sockets = new Set<Socket>();

	const server = createServer((incoming, response) => {
		const chunks: Buffer[] = [];

		incoming.on("data", (chunk: Buffer) => chunks.push(chunk));

		incoming.on("end", () => {
			const url = new URL(incoming.url ?? "/", "http://placeholder");
			const body = Buffer.concat(chunks).toString();

			let json: unknown;

			try {
				json = body === "" ? undefined : JSON.parse(body);
			} catch {
				json = undefined;
			}

			const recorded: RecordedRequest = {
				method: incoming.method ?? "",
				path: url.pathname,
				searchParams: url.searchParams,
				headers: incoming.headers,
				body,
				json,
			};

			requests.push(recorded);

			handler(recorded, response);
		});
	});

	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

	const { port } = server.address() as AddressInfo;

	return {
		baseUrl: `http://127.0.0.1:${port}`,
		requests,
		close: () =>
			new Promise<void>((resolve, reject) => {
				// Keep-alive connections would otherwise hold the close open for the
				// length of the agent's idle timeout.
				for (const socket of sockets) {
					socket.destroy();
				}

				server.close((err) => (err ? reject(err) : resolve()));
			}),
	};
}

/**
 * A base URL nothing is listening on, for producing a connection failure.
 *
 * Port 1 is privileged and unbound, so a connect attempt is refused
 * immediately rather than hanging until a timeout.
 */
export const UNREACHABLE_BASE_URL = "http://127.0.0.1:1";

/** Answer with a JSON body. */
export function respondJson(
	response: ServerResponse,
	status: number,
	body: unknown,
): void {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify(body));
}

/** Answer with a plain-text body, for the non-JSON error path. */
export function respondText(
	response: ServerResponse,
	status: number,
	body: string,
): void {
	response.writeHead(status, { "content-type": "text/plain" });
	response.end(body);
}
