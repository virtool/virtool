import { ClaimableJobWorkflow } from "@virtool/contracts";
import { resolveFileBacked } from "@virtool/contracts/env";
import type { StorageConfig } from "@virtool/storage";
import { z } from "zod";
import { WorkflowError } from "./errors";

/**
 * Every key a workflow run reads from the environment.
 *
 * Named explicitly rather than derived from the schema, because `_FILE`
 * resolution walks this list: a key missing from it silently loses its file
 * variant and reads only the plain environment.
 */
const KEYS = [
	"VT_JOBS_API_URL",
	"VT_MEM",
	"VT_PROC",
	"VT_WORKFLOW",
	"VT_WORK_PATH",
	"VT_TIMEOUT",
	"VT_SENTRY_DSN",
	"VT_IMAGE",
	"VT_STORAGE_BACKEND",
	"VT_STORAGE_S3_BUCKET",
	"VT_STORAGE_S3_REGION",
	"VT_STORAGE_S3_ENDPOINT",
	"VT_STORAGE_S3_ACCESS_KEY_ID",
	"VT_STORAGE_S3_SECRET_ACCESS_KEY",
	"VT_STORAGE_AZURE_ACCOUNT",
	"VT_STORAGE_AZURE_CONTAINER",
	"VT_STORAGE_AZURE_ACCESS_KEY",
	"VT_STORAGE_AZURE_ENDPOINT",
] as const;

const positiveInteger = z.coerce.number().int().positive();

const schema = z.object({
	// Python calls this `VT_JOBS_API_CONNECTION_STRING` and defaults it to
	// `https://localhost:9950`, which in a pod silently polls nothing and looks
	// like an idle runner rather than a misconfigured one. Required here
	// instead, and named for what it is — a base URL a path is appended to, not
	// a DSN — matching `VT_POSTGRES_URL`. A pod switched to a TypeScript image
	// without its manifest renaming the variable fails loudly at startup, which
	// is the whole reason this key keeps no default.
	VT_JOBS_API_URL: z.string().min(1),
	VT_MEM: positiveInteger.default(4),
	VT_PROC: positiveInteger.default(2),
	VT_WORKFLOW: ClaimableJobWorkflow,
	// Python defaults this to the relative path `temp`, and `createWorkPath`
	// deletes whatever it points at. Required here instead.
	VT_WORK_PATH: z.string().min(1),
	VT_TIMEOUT: positiveInteger.default(1000),
	VT_SENTRY_DSN: z.string().min(1).optional(),
	VT_IMAGE: z.string().min(1).default("unknown"),
	VT_STORAGE_BACKEND: z.enum(["s3", "azure"]),
	VT_STORAGE_S3_BUCKET: z.string().min(1).optional(),
	VT_STORAGE_S3_REGION: z.string().min(1).optional(),
	// Left unset for real AWS, which the SDK resolves from the region.
	VT_STORAGE_S3_ENDPOINT: z.string().min(1).optional(),
	VT_STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
	VT_STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
	VT_STORAGE_AZURE_ACCOUNT: z.string().min(1).optional(),
	VT_STORAGE_AZURE_CONTAINER: z.string().min(1).optional(),
	VT_STORAGE_AZURE_ACCESS_KEY: z.string().min(1).optional(),
	VT_STORAGE_AZURE_ENDPOINT: z.string().min(1).optional(),
});

/** Everything a workflow run reads from the environment at startup. */
export type WorkflowRunConfig = {
	jobsApiUrl: string;
	mem: number;
	proc: number;
	workflow: ClaimableJobWorkflow;
	workPath: string;
	timeout: number;
	sentryDsn?: string;
	image: string;
	/**
	 * The bucket a workflow pod reads its inputs from and writes its outputs to.
	 *
	 * A pod holds its own object-storage credentials and moves every byte
	 * itself; the jobs API serves records and never payloads. So this is
	 * required, not optional — a run with no bucket cannot download the reads it
	 * was claimed to analyse.
	 */
	storage: StorageConfig;
};

/**
 * Drop keys with no usable value.
 *
 * Deployment tooling routinely injects an empty string for a value it has
 * nothing to put in, and `resolveFileBacked` trims an empty file to the same
 * thing. Both mean unset, so a default applies rather than an empty credential
 * being sent as a literal or a coercion turning `""` into `0`.
 */
function withoutBlankValues(env: NodeJS.ProcessEnv): Record<string, string> {
	const present: Record<string, string> = {};

	for (const key of KEYS) {
		const value = env[key];

		if (value !== undefined && value.trim() !== "") {
			present[key] = value;
		}
	}

	return present;
}

/**
 * Resolve a workflow run's configuration from the environment.
 *
 * Every key also accepts a `<KEY>_FILE` variant naming a file to read the value
 * from, resolved by the helper shared with every other service so the
 * precedence rule — the file wins over a plain variable of the same name —
 * cannot drift. An unreadable path throws; an empty file is an unset value.
 *
 * The app entrypoint calls this and passes the result on as an argument.
 * Nothing in this package reads `process.env` at import time.
 *
 * @throws {WorkflowError} when a required key is missing or a value is invalid.
 */
export function parseWorkflowRunConfig(
	env: NodeJS.ProcessEnv,
): WorkflowRunConfig {
	const resolved = schema.safeParse(
		withoutBlankValues(resolveFileBacked(KEYS, env)),
	);

	if (!resolved.success) {
		const detail = resolved.error.issues
			.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
			.join("; ");

		throw new WorkflowError(`invalid workflow run configuration: ${detail}`);
	}

	const values = resolved.data;

	return {
		jobsApiUrl: values.VT_JOBS_API_URL,
		mem: values.VT_MEM,
		proc: values.VT_PROC,
		workflow: values.VT_WORKFLOW,
		workPath: values.VT_WORK_PATH,
		timeout: values.VT_TIMEOUT,
		sentryDsn: values.VT_SENTRY_DSN,
		image: values.VT_IMAGE,
		storage: resolveStorage(values),
	};
}

/**
 * Narrow the flat storage keys onto the backend's discriminated union.
 *
 * Done here rather than with a zod discriminated union so the message names the
 * one key that is missing. A pod misconfigured this way otherwise fails at the
 * first read, which for these workflows is after an aligner has already run.
 *
 * @throws {WorkflowError} when the chosen backend is missing a required key, or
 *   when exactly one half of the S3 credential pair is set.
 */
function resolveStorage(values: z.infer<typeof schema>): StorageConfig {
	if (values.VT_STORAGE_BACKEND === "azure") {
		return {
			kind: "azure",
			account: requireKey(
				values.VT_STORAGE_AZURE_ACCOUNT,
				"VT_STORAGE_AZURE_ACCOUNT",
			),
			container: requireKey(
				values.VT_STORAGE_AZURE_CONTAINER,
				"VT_STORAGE_AZURE_CONTAINER",
			),
			accessKey: values.VT_STORAGE_AZURE_ACCESS_KEY,
			endpoint: values.VT_STORAGE_AZURE_ENDPOINT,
		};
	}

	const accessKeyId = values.VT_STORAGE_S3_ACCESS_KEY_ID;
	const secretAccessKey = values.VT_STORAGE_S3_SECRET_ACCESS_KEY;

	// Both empty means the AWS credential chain supplies an IAM role. Exactly one
	// set is always a mistake, and silently ignoring the odd one out would send
	// the pod to production authenticating as the wrong principal.
	if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
		throw new WorkflowError(
			"invalid workflow run configuration: VT_STORAGE_S3_ACCESS_KEY_ID and VT_STORAGE_S3_SECRET_ACCESS_KEY must be set together, or both left empty to use IAM role credentials",
		);
	}

	return {
		kind: "s3",
		bucket: requireKey(values.VT_STORAGE_S3_BUCKET, "VT_STORAGE_S3_BUCKET"),
		region: values.VT_STORAGE_S3_REGION,
		endpoint: values.VT_STORAGE_S3_ENDPOINT,
		accessKeyId,
		secretAccessKey,
	};
}

function requireKey(value: string | undefined, key: string): string {
	if (value === undefined) {
		throw new WorkflowError(
			`invalid workflow run configuration: ${key}: Required`,
		);
	}

	return value;
}
