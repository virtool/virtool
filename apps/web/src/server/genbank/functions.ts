import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	GenbankUnreachableError,
	getGenbank,
} from "@virtool/data/genbank/data";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { ClientError } from "../errors";
import { logger } from "../logger";

// NCBI accessions are alphanumeric with dots and underscores (`NC_004452.3`).
// The value is interpolated into an outbound query string, so it is constrained
// rather than passed through.
const accessionSchema = z.object({
	accession: z
		.string()
		.trim()
		.min(1)
		.max(64)
		.regex(/^[A-Za-z0-9._-]+$/),
});

const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof GenbankUnreachableError) {
		setResponseStatus(502);
		throw new ClientError("Could not reach NCBI.", 502);
	}
	throw err;
});

/**
 * Look a sequence up in GenBank by accession, so the sequence form can fill
 * itself in.
 *
 * A pure outbound proxy — nothing here touches the database. It stays behind a
 * session because Python keeps it there: an open endpoint would let anyone use
 * the deployment as an unmetered NCBI relay under Virtool's `tool` and `email`
 * identifiers.
 */
export const getGenbankFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(accessionSchema)
	.handler(async ({ data }) => {
		const record = await getGenbank(logger, data.accession).catch(
			rethrowAsHttp,
		);

		if (record === null) {
			setResponseStatus(404);
			throw new ClientError("Accession not found.", 404);
		}

		return record;
	});
