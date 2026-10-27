import { createLogger } from "@virtool/logger";
import { startCreateAdministrator } from "./administrator";

async function dispatch(argv: string[]): Promise<void> {
	const [verb, resource, ...rest] = argv;
	if (verb === "create" && resource === "administrator") {
		await startCreateAdministrator(rest);
		return;
	}
	throw new Error(
		`unknown command "${[verb, resource].filter(Boolean).join(" ")}"; expected create administrator`,
	);
}

try {
	await dispatch(process.argv.slice(2));
} catch (err) {
	createLogger({ name: "dev-tools" }).fatal({ err }, "command failed");
	process.exitCode = 1;
}
