import { checkPostgres, summarizeReadiness } from "@virtool/data/health/data";
import { client } from "../composition";
import { logger } from "../logger";

/**
 * Probe every backing store and answer 200 or 503.
 *
 * Kept out of `routes/health/ready.ts` because a route file is part of the
 * browser program: reaching the pool from there would drag the data layer —
 * and `node:*` — into the client graph.
 */
export async function handleReady(): Promise<Response> {
	const report = summarizeReadiness(await checkPostgres(client, logger));

	return Response.json(
		{ status: report.status, checks: report.checks },
		{ status: report.statusCode },
	);
}
