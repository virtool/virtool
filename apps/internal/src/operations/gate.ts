import type { DbOrTx } from "@virtool/data/db/pg";
import {
	getOperation,
	listOperationVersions,
} from "@virtool/data/operations/data";
import type { OperationRegistry } from "./define";

/**
 * Why a required operation does not let a migration through.
 *
 * Every reason is a refusal, and the differences between them are what an
 * operator does next rather than how serious they are.
 *
 * - `unregistered` — the migration names an operation this image does not
 *   carry. A deployment mistake, not a data problem.
 * - `never_run` — no attempt has been recorded for this key at all.
 * - `stale` — the key has run, but at a version other than the one this image
 *   declares. The implementation was patched; what it passed is not what it
 *   would check now.
 * - `running` — an attempt is recorded as in flight, or a process died holding
 *   one. Either way this one waits.
 * - `failed` — the operation reached its own conclusion and objected. There is
 *   data to remediate.
 * - `errored` — the attempt broke before concluding. It says nothing about the
 *   data; run it again.
 */
export type GateBlockReason =
	| "unregistered"
	| "never_run"
	| "stale"
	| "running"
	| "failed"
	| "errored";

/** One required operation that is not satisfied, and why. */
export type GateBlocker = {
	/** The migration that declared the requirement. */
	tag: string;
	key: string;
	/** The version this image declares, or `undefined` when unregistered. */
	version: number | undefined;
	reason: GateBlockReason;
	/** One line, written for the operator reading the runner's output. */
	detail: string;
};

/**
 * Decide whether every operation `tag` requires has passed.
 *
 * Returns one blocker per unsatisfied requirement rather than the first,
 * because an operator fixing them one deploy at a time is the slowest possible
 * way to learn there were three.
 *
 * A pass is only a pass at the declared version: a row is looked up by
 * `(key, version)`, so a patched implementation has no row until it runs and
 * the outstanding pass cannot stand in for it.
 */
export async function evaluateMigrationGate(
	db: DbOrTx,
	registry: OperationRegistry,
	tag: string,
	required: readonly string[],
): Promise<GateBlocker[]> {
	const blockers: GateBlocker[] = [];

	for (const key of required) {
		const definition = registry[key];

		if (definition === undefined) {
			blockers.push({
				tag,
				key,
				version: undefined,
				reason: "unregistered",
				detail: `no operation named "${key}" is registered in this image`,
			});
			continue;
		}

		const { version } = definition;
		const row = await getOperation(db, key, version);

		if (row === undefined) {
			const previous = await listOperationVersions(db, key);

			blockers.push({
				tag,
				key,
				version,
				reason: previous.length === 0 ? "never_run" : "stale",
				detail:
					previous.length === 0
						? `"${key}" has never run`
						: `"${key}" last ran at version ${previous[previous.length - 1]?.version}, and version ${version} has not run`,
			});
			continue;
		}

		if (row.status === "passed") {
			continue;
		}

		blockers.push({
			tag,
			key,
			version,
			reason: row.status,
			detail: describeStatus(key, version, row.status, row.error),
		});
	}

	return blockers;
}

/** The operator-facing line for a recorded, non-passing status. */
function describeStatus(
	key: string,
	version: number,
	status: "running" | "failed" | "errored",
	error: string | null,
): string {
	switch (status) {
		case "running":
			return `"${key}" version ${version} is recorded as running; wait for it, or re-run it if the process that started it is gone`;
		case "failed":
			return `"${key}" version ${version} reported findings; inspect them with "operations export ${key}"`;
		case "errored":
			return `"${key}" version ${version} errored before concluding: ${error ?? "no message recorded"}`;
	}
}
