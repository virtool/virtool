import { writeFile } from "node:fs/promises";
import {
	hasActionableFindings,
	type IdentityReport,
	runIdentityMigration,
} from "@virtool/data/auth/migration";
import type { Db } from "@virtool/data/db/pg";
import type { Logger } from "@virtool/logger";

/** What the `auth` subcommand was asked to do. */
export type AuthCommand = {
	mode: "audit" | "apply";
	reportPath?: string;
	batchSize?: number;
};

/** An argument the command cannot act on. */
export class AuthArgumentError extends Error {}

/** Read the arguments after `auth`, defaulting to the read-only audit mode. */
export function parseAuthCommand(argv: readonly string[]): AuthCommand {
	const [first, ...rest] = argv;
	const flags = first === undefined || first.startsWith("--") ? argv : rest;

	let mode: AuthCommand["mode"] = "audit";

	if (first !== undefined && !first.startsWith("--")) {
		if (first !== "audit" && first !== "apply") {
			throw new AuthArgumentError(
				`unknown mode "${first}"; expected audit or apply`,
			);
		}
		mode = first;
	}

	const command: AuthCommand = { mode };

	for (let index = 0; index < flags.length; index += 1) {
		const flag = flags[index];
		const value = flags[index + 1];

		if (flag === "--report") {
			if (value === undefined || value.startsWith("--")) {
				throw new AuthArgumentError("--report needs a path");
			}
			command.reportPath = value;
			index += 1;
			continue;
		}

		if (flag === "--batch-size") {
			const parsed = Number(value);
			if (!Number.isInteger(parsed) || parsed < 1) {
				throw new AuthArgumentError("--batch-size needs a positive integer");
			}
			command.batchSize = parsed;
			index += 1;
			continue;
		}

		throw new AuthArgumentError(`unknown argument "${flag}"`);
	}

	return command;
}

/** Write the sensitive report with owner-only permissions. */
async function writeReport(
	path: string,
	report: IdentityReport,
): Promise<void> {
	await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, {
		encoding: "utf8",
		mode: 0o600,
	});
}

/**
 * Run the legacy identity audit or backfill and report the process exit code.
 *
 * Zero means the run finished and left nothing for an operator to resolve.
 * Incomplete users are not such a finding — they are the population the bounded
 * remediation window exists for — but a conflict or an unusable password hash
 * is, and so is a schema or argument error.
 *
 */
export async function runAuthCommand(
	db: Db,
	logger: Logger,
	argv: readonly string[],
): Promise<number> {
	let command: AuthCommand;

	try {
		command = parseAuthCommand(argv);
	} catch (err) {
		logger.error({ err }, "bad arguments");
		return 1;
	}

	let report: IdentityReport;

	try {
		report = await runIdentityMigration(db, logger, {
			mode: command.mode,
			batchSize: command.batchSize,
		});
	} catch (err) {
		logger.error({ err }, "failed to run the legacy identity migration");
		return 1;
	}

	if (command.reportPath !== undefined) {
		await writeReport(command.reportPath, report);
		logger.info({ path: command.reportPath }, "wrote report");
	}

	if (hasActionableFindings(report)) {
		logger.error(
			{
				conflict: report.counts.conflict,
				invalidPassword: report.counts.invalidPassword,
			},
			"legacy identities need operator attention",
		);
		return 1;
	}

	return 0;
}
