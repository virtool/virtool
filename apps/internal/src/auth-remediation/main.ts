import { resolveFileBacked } from "@virtool/contracts/env";
import { getEmailRemediationReport } from "@virtool/data/auth/remediation";
import { createDb } from "@virtool/data/db/pg";
import { createLogger } from "@virtool/logger";
import { z } from "zod";

const AuthRemediationEnv = z.object({
	VT_POSTGRES_URL: z.string().url(),
});

/** Write the live legacy-email cutover report to stdout as JSON. */
export async function startAuthRemediation(argv: readonly string[]) {
	const [command] = argv;
	if (command !== "report") {
		throw new Error(
			`unknown auth-remediation command ${command ? `"${command}"` : "(none)"}; expected report`,
		);
	}

	const env = AuthRemediationEnv.parse(
		resolveFileBacked(Object.keys(AuthRemediationEnv.shape), process.env),
	);
	const { client, db } = createDb(
		{ postgresUrl: env.VT_POSTGRES_URL, postgresPoolMax: 1 },
		"auth-remediation",
	);

	try {
		const report = await getEmailRemediationReport(db);
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		if (!report.readyForCutover) {
			process.exitCode = 1;
		}
	} catch (err) {
		createLogger({ name: "auth-remediation" }).fatal(
			{ err },
			"failed to report email remediation state",
		);
		process.exitCode = 1;
	} finally {
		await client.end();
	}
}
