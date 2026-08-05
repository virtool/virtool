import { readFileSync } from "node:fs";
import type { StorageConfig } from "@virtool/storage";

/** Everything this process reads from the environment at startup. */
export type Config = {
	storage: StorageConfig;
	subtractionId: string;
};

/**
 * Read `<key>`, preferring the contents of the file named by `<key>_FILE`.
 *
 * The file wins over a plain variable of the same name: a rollout moving to a
 * secrets-store mount can still carry the stale variable from the `Secret` it
 * replaces, and erroring on the overlap would crashloop the rollout that fixes
 * it.
 *
 * Unset and empty are the same thing here. Deployment tooling routinely injects
 * an empty string for a value it has nothing to put in, and an empty access key
 * must fall back to the credential chain rather than be sent as a literal empty
 * credential.
 */
function read(key: string): string | undefined {
	const path = process.env[`${key}_FILE`];
	const value = path ? readFileSync(path, "utf8").trim() : process.env[key];

	return value ? value : undefined;
}

function requireEnv(key: string): string {
	const value = read(key);

	if (!value) {
		throw new Error(`${key} is required`);
	}

	return value;
}

function readStorage(): StorageConfig {
	const backend = read("VT_STORAGE_BACKEND");

	if (backend === "azure") {
		return {
			kind: "azure",
			account: requireEnv("VT_STORAGE_AZURE_ACCOUNT"),
			container: requireEnv("VT_STORAGE_AZURE_CONTAINER"),
			accessKey: read("VT_STORAGE_AZURE_ACCESS_KEY"),
			endpoint: read("VT_STORAGE_AZURE_ENDPOINT"),
		};
	}

	if (backend !== "s3") {
		throw new Error("VT_STORAGE_BACKEND must be one of s3, azure");
	}

	const accessKeyId = read("VT_STORAGE_S3_ACCESS_KEY_ID");
	const secretAccessKey = read("VT_STORAGE_S3_SECRET_ACCESS_KEY");

	// Both empty means the AWS credential chain supplies an IAM role. Exactly one
	// set is always a mistake, and silently ignoring the odd one out would send
	// the pod to production authenticating as the wrong principal.
	if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
		throw new Error(
			"VT_STORAGE_S3_ACCESS_KEY_ID and VT_STORAGE_S3_SECRET_ACCESS_KEY must be set together, or both left empty to use IAM role credentials",
		);
	}

	return {
		kind: "s3",
		bucket: requireEnv("VT_STORAGE_S3_BUCKET"),
		region: read("VT_STORAGE_S3_REGION"),
		// Left unset for real AWS, which the SDK resolves from the region.
		endpoint: read("VT_STORAGE_S3_ENDPOINT"),
		accessKeyId,
		secretAccessKey,
	};
}

/**
 * Resolve configuration from the environment.
 *
 * `VT_SUBTRACTION_ID` is a stand-in for the id carried by a claimed job, and
 * gives way to it when the runtime core lands.
 */
export function readConfig(): Config {
	return {
		storage: readStorage(),
		subtractionId: requireEnv("VT_SUBTRACTION_ID"),
	};
}
