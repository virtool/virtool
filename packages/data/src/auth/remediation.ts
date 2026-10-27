import { and, count, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/pg";
import { users } from "../db/schema/users";

/** The live count of normal accounts that have not completed email remediation. */
export type EmailRemediationReport = {
	activeUnmigrated: number;
	deactivatedUnmigrated: number;
	generatedAt: string;
};

/** Count normal legacy accounts that still lack a Better Auth identity. */
export async function getEmailRemediationReport(
	db: Db,
): Promise<EmailRemediationReport> {
	const rows = await db
		.select({ active: users.active, users: count() })
		.from(users)
		.where(
			and(eq(users.lifecycleState, "normal"), isNull(users.authMigratedAt)),
		)
		.groupBy(users.active);

	const activeUnmigrated = rows.find((row) => row.active)?.users ?? 0;
	const deactivatedUnmigrated = rows.find((row) => !row.active)?.users ?? 0;

	return {
		activeUnmigrated,
		deactivatedUnmigrated,
		generatedAt: new Date().toISOString(),
	};
}
