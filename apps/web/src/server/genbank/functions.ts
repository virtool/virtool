import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import type { Genbank } from "@virtool/contracts";
import { getSettings } from "@virtool/data/settings/data";
import {
	createNcbiClient,
	NcbiUnreachableError,
	NcbiUnreadableError,
} from "@virtool/ncbi/client";
import { z } from "zod";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";

// NCBI accessions are alphanumeric with dots and underscores (`NC_004452.3`).
// The value goes into an outbound query string, so it is constrained rather
// than passed through.
const accessionSchema = z.object({
	accession: z
		.string()
		.trim()
		.min(1)
		.max(64)
		.regex(/^[A-Za-z0-9._-]+$/),
});

const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (err instanceof NcbiUnreachableError) {
		setResponseStatus(502);
		throw new ClientError("Could not reach NCBI.", 502);
	}

	// NCBI sent the record, but this side cannot read it. That is not a missing
	// accession, and a 404 would tell the user the record does not exist. The
	// record does exist, and Virtool cannot use it.
	if (err instanceof NcbiUnreadableError) {
		logger.warn({ err: err.message }, "could not read genbank record");

		setResponseStatus(422);
		throw new ClientError("NCBI returned a record Virtool cannot read.", 422);
	}

	throw err;
});

/**
 * Find a sequence in GenBank by accession, so that the sequence form can fill
 * itself in.
 *
 * The one database read gets the instance's NCBI API key. The key increases
 * the rate limit that NCBI applies to the deployment. The client goes here and
 * not in a module constant, because the key can change while the server runs.
 *
 * This function stays behind a session. An open endpoint would let any person
 * use the deployment as an unmetered relay to NCBI, under Virtool's `tool` and
 * `email` identifiers and its API key.
 */
export const getGenbankFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(accessionSchema)
	.handler(async ({ data }): Promise<Genbank> => {
		const { ncbiApiKey } = await getSettings(db);

		const record = await createNcbiClient({ apiKey: ncbiApiKey, logger })
			.fetchGenbankRecord(data.accession)
			.catch(rethrowAsHttp);

		if (record === null) {
			setResponseStatus(404);
			throw new ClientError("Accession not found.", 404);
		}

		return {
			// The versioned accession, which is what the form shows and what the
			// old flat-file client sent. `record.accession` has no version.
			accession: record.accession_version,
			definition: record.definition,
			host: record.source.host ?? "",
			sequence: record.sequence,
		};
	});
