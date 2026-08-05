import { readFileSync } from "node:fs";

/**
 * Suffix naming the file a value is read from.
 *
 * The convention Prometheus and Docker use, and the reason it is worth having:
 * a Kubernetes `Secret` populated by the secrets-store CSI driver goes stale
 * when a key is added to the `SecretProviderClass`, so a pod can start with an
 * env var the cluster believes it has updated. The driver's file mount has no
 * such staleness.
 */
const FILE_SUFFIX = "_FILE";

/**
 * Resolve every `<KEY>_FILE` variant in `env` into its plain `<KEY>`.
 *
 * Reached through the `@virtool/contracts/env` subpath rather than the package
 * barrel, so `node:fs` never enters the browser graph. Every server that parses
 * configuration shares this one implementation — `apps/web` over its zod
 * schema's keys, `apps/jobs-api` over its own much smaller list — because a
 * second copy is free to drift on the precedence rule below.
 *
 * **The file wins over a plain variable of the same name.** A rollout moving to
 * the mount can still carry the stale env var from the `Secret` it replaces,
 * and erroring on the overlap would crashloop the very rollout that fixes it.
 *
 * An unreadable path throws, so a misconfigured mount fails at startup rather
 * than silently falling back. An empty file is an unset value: the trimmed
 * empty string is what the caller's schema then sees.
 */
export function resolveFileBacked(
	keys: Iterable<string>,
	env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const resolved = { ...env };

	for (const key of keys) {
		const path = env[`${key}${FILE_SUFFIX}`];

		if (!path) {
			continue;
		}

		try {
			resolved[key] = readFileSync(path, "utf8").trim();
		} catch (error) {
			throw new Error(
				`${key}${FILE_SUFFIX} points at ${path}, which could not be read`,
				{ cause: error },
			);
		}
	}

	return resolved;
}
