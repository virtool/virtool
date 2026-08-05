import { createServer, type ServerResponse } from "node:http";
import { createDb, logPostgresVersion } from "@virtool/data/db/pg";
import { checkPostgres, summarizeReadiness } from "@virtool/data/health/data";
import { createLogger } from "@virtool/logger";
import { readConfig } from "./config";

const config = readConfig();
const logger = createLogger({ name: "jobs-api" });
const { client } = createDb(config);

function send(response: ServerResponse, status: number, body: unknown): void {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
	const path = new URL(request.url ?? "/", "http://localhost").pathname;

	if (request.method !== "GET") {
		send(response, 405, { error: "method not allowed" });
		return;
	}

	if (path === "/health/live") {
		send(response, 200, { status: "alive" });
		return;
	}

	if (path === "/health/ready") {
		void checkPostgres(client, logger).then((postgres) => {
			const report = summarizeReadiness(postgres);
			send(response, report.statusCode, {
				status: report.status,
				checks: report.checks,
			});
		});
		return;
	}

	send(response, 404, { error: "not found" });
});

logPostgresVersion(client, logger);

server.listen(config.port, config.host, () => {
	logger.info({ host: config.host, port: config.port }, "listening");
});

// A pod is deleted with SIGTERM. Close the listener and drain the pool so
// in-flight readiness probes finish rather than being cut off mid-query.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		logger.info({ signal }, "shutting down");
		server.close(() => {
			void client.end();
		});
	});
}
