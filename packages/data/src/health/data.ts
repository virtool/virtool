import type { Logger } from "@virtool/logger";
import type { PgClient } from "../db/pg";

const CHECK_TIMEOUT_MS = 5_000;

/** The result of probing a single backing store. */
export type StoreCheck = {
	ok: boolean;
};

/** A readiness verdict over every backing store, with the HTTP status to report. */
export type ReadyReport = {
	status: "ready" | "unavailable";
	statusCode: 200 | 503;
	checks: { postgres: StoreCheck };
};

/** Fold per-store checks into a single ready/unavailable verdict. */
export function summarizeReadiness(postgres: StoreCheck): ReadyReport {
	const ok = postgres.ok;

	return {
		status: ok ? "ready" : "unavailable",
		statusCode: ok ? 200 : 503,
		checks: { postgres },
	};
}

/** Reject if `promise` does not settle within `ms` milliseconds. */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`health check timed out after ${ms}ms`));
		}, ms);

		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			},
		);
	});
}

/** Probe Postgres with a trivial query. Never throws. */
export async function checkPostgres(
	client: PgClient,
	logger: Logger,
): Promise<StoreCheck> {
	try {
		await withTimeout(client`SELECT 1`, CHECK_TIMEOUT_MS);
		return { ok: true };
	} catch (err) {
		logger.warn({ err }, "postgres health check failed");
		return { ok: false };
	}
}
