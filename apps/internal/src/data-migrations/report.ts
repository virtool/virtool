import * as Sentry from "@sentry/node";
import {
	type DataMigrationRow,
	listDataMigrationFindings,
} from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";

/** A data migration's recorded outcome and findings, as `export` writes it. */
export type DataMigrationReport = Pick<
	DataMigrationRow,
	| "key"
	| "version"
	| "kind"
	| "status"
	| "attempts"
	| "startedAt"
	| "finishedAt"
	| "error"
	| "summary"
> & {
	findings: { code: string; subject: string | null; detail: unknown }[];
};

/** Get the outcome and findings recorded for `row`'s most recent attempt. */
export async function getDataMigrationReport(
	db: Db,
	row: DataMigrationRow,
): Promise<DataMigrationReport> {
	const findings = await listDataMigrationFindings(db, row.id);

	return {
		key: row.key,
		version: row.version,
		kind: row.kind,
		status: row.status,
		attempts: row.attempts,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt,
		error: row.error,
		summary: row.summary,
		findings: findings.map((finding) => ({
			code: finding.code,
			subject: finding.subject,
			detail: finding.detail,
		})),
	};
}

/**
 * Report a data migration that finished with findings to Sentry as one issue
 * per key and version, with the full report attached so an operator doesn't
 * have to run `data-migrations export` in the cluster.
 */
export function captureDataMigrationFindings(
	report: DataMigrationReport,
): void {
	const findingsByCode: Record<string, number> = {};

	for (const finding of report.findings) {
		findingsByCode[finding.code] = (findingsByCode[finding.code] ?? 0) + 1;
	}

	Sentry.withScope((scope) => {
		scope.setTags({
			data_migration: report.key,
			data_migration_version: report.version,
			data_migration_kind: report.kind,
		});
		scope.setFingerprint([
			"data-migration-findings",
			report.key,
			String(report.version),
		]);
		scope.setContext("data_migration", {
			attempts: report.attempts,
			findings: report.findings.length,
			findings_by_code: findingsByCode,
			summary: report.summary,
		});
		scope.addAttachment({
			filename: `${report.key}-v${report.version}.json`,
			data: JSON.stringify(report, null, 2),
			contentType: "application/json",
		});
		Sentry.captureMessage(
			`data migration ${report.key}@${report.version} did not pass`,
			"error",
		);
	});
}
