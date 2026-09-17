import { randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function writeSecret(path: string): Promise<void> {
	try {
		await readFile(path);
	} catch {
		await writeFile(path, randomBytes(32).toString("base64"), { mode: 0o600 });
	}
}

/** Materialized, durable inputs for one environment. */
export type EnvironmentFiles = {
	composeFile: string;
	directory: string;
	envFile: string;
};

export async function ensureEnvironmentFiles(
	stateDirectory: string,
	input: {
		environmentId: string;
		name: string;
		repositoryId: string;
		worktree: string;
	},
): Promise<EnvironmentFiles> {
	const directory = join(stateDirectory, "environments", input.environmentId);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	await Promise.all([
		writeSecret(join(directory, "auth-secret")),
		writeSecret(join(directory, "encryption-key")),
	]);
	try {
		await copyFile(
			join(input.worktree, "dev/scripts/cleanup-database.sh"),
			join(directory, "cleanup-database.sh"),
		);
	} catch {
		await readFile(join(directory, "cleanup-database.sh"));
	}
	const database = `virtool_${input.environmentId.replaceAll("-", "")}`;
	const container = `virtool-${input.environmentId.replaceAll("-", "")}`;
	const envFile = join(directory, "environment.env");
	await writeFile(
		envFile,
		`${[
			`VT_DEV_CONFIG_DIR=${directory}`,
			`VT_DEV_ENVIRONMENT_ID=${input.environmentId}`,
			`VT_DEV_ENVIRONMENT_NAME=${input.name}`,
			`VT_DEV_GENERATION=1`,
			`VT_DEV_REPOSITORY_ID=${input.repositoryId}`,
			`VT_DEV_SHARED_NETWORK=virtool-dev-${input.repositoryId}`,
			`VT_DEV_WORKTREE=${input.worktree}`,
			`VT_DEV_DATABASE=${database}`,
			`VT_DEV_BLOB_CONTAINER=${container}`,
			`VT_DEV_HOSTNAME=${input.name}.localhost`,
			`VT_PUBLIC_ORIGIN=https://${input.name}.localhost:9443`,
		].join("\n")}\n`,
		{ mode: 0o600 },
	);
	return {
		composeFile: join(directory, "compose.yaml"),
		directory,
		envFile,
	};
}
