import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	CreateLocalOtuCommand,
	type GenbankOtuDraft,
} from "@virtool/contracts";
import {
	createLocalOtu,
	getLocalOtu,
	getLocalOtus,
	OtuV2ConflictError,
	OtuV2NotFoundError,
	OtuV2ReferenceNotWritableError,
} from "@virtool/data/otus-v2/data";
import { resolveReferenceActor } from "@virtool/data/references/data";
import {
	checkReferenceV2Right,
	checkReferenceV2Visibility,
	ReferenceV2NotFoundError,
} from "@virtool/data/references-v2/data";
import { getSettings } from "@virtool/data/settings/data";
import { createNcbiClient, NcbiUnreachableError } from "@virtool/ncbi/client";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated } from "../auth/policy";
import { db } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import {
	buildGenbankOtuDraft,
	GenbankOtuEmptyError,
	GenbankOtuMixedTaxidError,
} from "./genbank";

const referenceIdSchema = z.object({
	referenceId: z.uuid(),
});

const otuReadSchema = z.object({
	referenceId: z.uuid(),
	otuId: z.uuid(),
});

const createLocalOtuSchema = z.object({
	referenceId: z.uuid(),
	command: CreateLocalOtuCommand,
});

// The accessions go into an outbound NCBI query string, so each is constrained
// rather than passed through. Bounded at 500 to match one NCBI batch request.
const genbankOtuDraftSchema = z.object({
	referenceId: z.uuid(),
	accessions: z
		.array(
			z
				.string()
				.trim()
				.min(1)
				.max(64)
				.regex(/^[A-Za-z0-9._-]+$/),
		)
		.min(1)
		.max(500),
});

// Wrapped in createServerOnlyFn so the compiler can strip these bodies — and the
// ./data imports they reference — from the client bundle. A plain top-level
// helper would pin ./data and its postgres transitive dependency in the client
// graph.
const rethrowAsHttp = createServerOnlyFn((err: unknown): never => {
	if (
		err instanceof OtuV2NotFoundError ||
		err instanceof ReferenceV2NotFoundError
	) {
		setResponseStatus(404);
		throw new ClientError("OTU not found.", 404);
	}
	if (err instanceof OtuV2ReferenceNotWritableError) {
		setResponseStatus(409);
		throw new ClientError("Reference cannot be modified.", 409);
	}
	if (err instanceof OtuV2ConflictError) {
		setResponseStatus(409);
		throw new ClientError("OTU already exists.", 409);
	}
	throw err;
});

export const createLocalOtuFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createLocalOtuSchema)
	.handler(async ({ context, data }) => {
		try {
			// The rights check runs before the create's archived/remote refusal, so a
			// caller without `modifyOtu` learns nothing about the Reference's state.
			// A non-administrator naming a missing Reference gets a 404 here; an
			// administrator passes and the create raises the same 404 from inside its
			// transaction.
			const actor = await resolveReferenceActor(db, context.session.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}

			const otu = await createLocalOtu(db, {
				referenceId: data.referenceId,
				userId: context.session.userId,
				command: data.command,
			});
			setResponseStatus(201);
			return otu;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

/**
 * Resolve one or more NCBI accessions into a neutral OTU draft.
 *
 * This stays behind the `modifyOtu` right and a session: it uses the instance's
 * NCBI API key to reach NCBI, and an open endpoint would let any caller relay
 * unmetered requests through the deployment. The client turns the returned
 * draft into a complete `CreateOTU` command, so the whole aggregate is still
 * minted client-side and written through {@link createLocalOtuFn}.
 */
export const getGenbankOtuDraftFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(genbankOtuDraftSchema)
	.handler(async ({ context, data }): Promise<GenbankOtuDraft> => {
		const actor = await resolveReferenceActor(db, context.session.userId);
		if (
			!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
		) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}

		const accessions = Array.from(new Set(data.accessions));

		const { ncbiApiKey } = await getSettings(db);
		const client = createNcbiClient({ apiKey: ncbiApiKey, logger });

		const records = await client
			.fetchGenbankRecords(accessions)
			.catch((err: unknown): never => {
				if (err instanceof NcbiUnreachableError) {
					setResponseStatus(502);
					throw new ClientError("Could not reach NCBI.", 502);
				}
				throw err;
			});

		// fetchGenbankRecords drops accessions NCBI has no record for, so a caller
		// that mistyped one gets told which, not a silently smaller OTU.
		const found = new Set<string>();
		for (const record of records) {
			found.add(record.accession.toLowerCase());
			found.add(record.accession_version.toLowerCase());
		}
		const missing = accessions.filter(
			(accession) => !found.has(accession.toLowerCase()),
		);
		if (missing.length > 0) {
			setResponseStatus(404);
			throw new ClientError(
				`Accessions not found: ${missing.join(", ")}.`,
				404,
			);
		}

		const [firstRecord] = records;
		if (!firstRecord) {
			setResponseStatus(404);
			throw new ClientError("Accessions not found.", 404);
		}

		// The acronym and species name are a best-effort enrichment; a taxonomy
		// lookup that fails still yields a draft named after the record organism.
		const taxonomy = await client
			.fetchTaxonomyRecord(firstRecord.source.taxid)
			.catch(() => null);

		try {
			return buildGenbankOtuDraft(records, taxonomy);
		} catch (err) {
			if (err instanceof GenbankOtuMixedTaxidError) {
				setResponseStatus(422);
				throw new ClientError(
					"Accessions belong to different organisms. Create a separate OTU for each.",
					422,
				);
			}
			if (err instanceof GenbankOtuEmptyError) {
				setResponseStatus(404);
				throw new ClientError("Accessions not found.", 404);
			}
			throw err;
		}
	});

export const getLocalOtusFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			// An invisible Reference surfaces as a 404, never an empty list.
			const actor = await resolveReferenceActor(db, context.session.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getLocalOtus(db, data.referenceId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getLocalOtuFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(otuReadSchema)
	.handler(async ({ context, data }) => {
		try {
			// An invisible Reference and a missing OTU both surface as a 404.
			const actor = await resolveReferenceActor(db, context.session.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getLocalOtu(db, data.referenceId, data.otuId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
