import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import {
	CreateLocalOtuCommand,
	CreateLocalOtuIsolateCommand,
	DeleteLocalOtuCommand,
	DeleteLocalOtuIsolateCommand,
	type GenbankIsolateDraft,
	type GenbankOtuDraft,
	UpdateLocalOtuIsolateCommand,
	UpdateLocalOtuPlanCommand,
	UpdateLocalOtuTaxonomyCommand,
} from "@virtool/contracts";
import {
	createLocalOtu,
	createLocalOtuIsolate,
	deleteLocalOtu,
	deleteLocalOtuIsolate,
	getLocalOtu,
	getLocalOtuIsolate,
	getLocalOtuIsolates,
	getLocalOtuOverview,
	getLocalOtuSequence,
	getLocalOtus,
	OtuV2ConflictError,
	OtuV2DuplicateAccessionError,
	OtuV2InvalidIsolateError,
	OtuV2InvalidPlanError,
	OtuV2InvalidProvenanceError,
	OtuV2LastIsolateError,
	OtuV2NotFoundError,
	OtuV2ReferenceNotWritableError,
	OtuV2VersionConflictError,
	previewLocalOtuPlan,
	updateLocalOtuIsolate,
	updateLocalOtuPlan,
	updateLocalOtuTaxonomy,
} from "@virtool/data/otus-v2/data";
import { resolveReferenceActor } from "@virtool/data/references/data";
import {
	checkReferenceV2Right,
	checkReferenceV2Visibility,
	ReferenceV2NotFoundError,
} from "@virtool/data/references-v2/data";
import { getSettings } from "@virtool/data/settings/data";
import { resolveNcbiApiKey } from "@virtool/data/settings/ncbi";
import { createNcbiClient, NcbiUnreachableError } from "@virtool/ncbi/client";
import { z } from "zod";
import { ForbiddenError } from "../auth/middleware";
import { authenticated } from "../auth/policy";
import { db, keyring } from "../composition";
import { ClientError } from "../errors";
import { logger } from "../logger";
import {
	buildGenbankIsolateDraft,
	buildGenbankOtuDraft,
	GenbankMixedIsolateError,
	GenbankOtuEmptyError,
	GenbankOtuMixedTaxidError,
	GenbankProvenanceError,
	GenbankSegmentError,
	GenbankTaxonomyError,
	validateGenbankIsolateSave,
	validateGenbankOtuSave,
} from "./genbank";

const referenceIdSchema = z.object({
	referenceId: z.uuid(),
});

const otuReadSchema = z.object({
	referenceId: z.uuid(),
	otuId: z.uuid(),
});

const isolateReadSchema = otuReadSchema.extend({ isolateId: z.uuid() });
const sequenceReadSchema = isolateReadSchema.extend({ sequenceId: z.uuid() });

const createLocalOtuSchema = z.object({
	referenceId: z.uuid(),
	command: CreateLocalOtuCommand,
});

const createLocalOtuIsolateSchema = z.object({
	referenceId: z.uuid(),
	command: CreateLocalOtuIsolateCommand,
});

const updateLocalOtuTaxonomySchema = z.object({
	referenceId: z.uuid(),
	command: UpdateLocalOtuTaxonomyCommand,
});

const updateLocalOtuPlanSchema = z.object({
	referenceId: z.uuid(),
	command: UpdateLocalOtuPlanCommand,
});

const updateLocalOtuIsolateSchema = z.object({
	referenceId: z.uuid(),
	command: UpdateLocalOtuIsolateCommand,
});

const deleteLocalOtuSchema = z.object({
	referenceId: z.uuid(),
	command: DeleteLocalOtuCommand,
});

const deleteLocalOtuIsolateSchema = z.object({
	referenceId: z.uuid(),
	command: DeleteLocalOtuIsolateCommand,
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

const genbankIsolateDraftSchema = z.object({
	referenceId: z.uuid(),
	otuId: z.uuid(),
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
	if (err instanceof OtuV2DuplicateAccessionError) {
		setResponseStatus(409);
		throw new ClientError(
			err.message
				? `Accession ${err.message} is already in this OTU.`
				: "An accession is already in this OTU.",
			409,
		);
	}
	if (err instanceof OtuV2InvalidProvenanceError) {
		setResponseStatus(422);
		throw new ClientError("Invalid GenBank accession provenance.", 422);
	}
	if (err instanceof OtuV2VersionConflictError) {
		setResponseStatus(409);
		throw new ClientError("OTU has changed. Review it again.", 409);
	}
	if (err instanceof OtuV2LastIsolateError) {
		setResponseStatus(409);
		throw new ClientError("An OTU must have at least one isolate.", 409);
	}
	if (err instanceof OtuV2InvalidIsolateError) {
		setResponseStatus(422);
		throw new ClientError("Isolate does not satisfy the OTU plan.", 422);
	}
	if (err instanceof OtuV2InvalidPlanError) {
		setResponseStatus(422);
		throw new ClientError("Plan does not belong to this OTU.", 422);
	}
	if (err instanceof GenbankOtuMixedTaxidError) {
		setResponseStatus(422);
		throw new ClientError("Accessions belong to different organisms.", 422);
	}
	if (err instanceof GenbankMixedIsolateError) {
		setResponseStatus(422);
		throw new ClientError("Accessions belong to different isolates.", 422);
	}
	if (err instanceof GenbankTaxonomyError) {
		setResponseStatus(422);
		throw new ClientError(
			"A species-level NCBI taxonomy match is required.",
			422,
		);
	}
	if (err instanceof GenbankSegmentError) {
		setResponseStatus(422);
		throw new ClientError(
			`Could not match ${err.message} to an OTU segment.`,
			422,
		);
	}
	if (err instanceof GenbankProvenanceError) {
		setResponseStatus(422);
		throw new ClientError(
			"Isolate sequences do not match their GenBank accessions.",
			422,
		);
	}
	if (err instanceof NcbiUnreachableError) {
		setResponseStatus(502);
		throw new ClientError("Could not reach NCBI.", 502);
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
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			const provenance = data.command.payload.genbank;
			if (provenance) {
				const { ncbiApiKey } = await getSettings(db);
				const { apiKey } = resolveNcbiApiKey(ncbiApiKey, keyring);
				const client = createNcbiClient({ apiKey: apiKey ?? "", logger });
				const accessions = provenance.sequences.map((item) => item.accession);
				const records = await client.fetchGenbankRecords(accessions);
				const found = new Set(
					records.map((record) => record.accession_version.toLowerCase()),
				);
				if (
					records.length !== accessions.length ||
					accessions.some((accession) => !found.has(accession.toLowerCase()))
				) {
					throw new GenbankProvenanceError();
				}
				const taxonomy = records[0]
					? await client.fetchTaxonomyRecord(records[0].source.taxid)
					: null;
				validateGenbankOtuSave(data.command, records, taxonomy);
			}

			const otu = await createLocalOtu(db, {
				referenceId: data.referenceId,
				userId: context.principal.userId,
				command: data.command,
			});
			setResponseStatus(201);
			return otu;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const createLocalOtuIsolateFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(createLocalOtuIsolateSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			const provenance = data.command.payload.genbank;
			if (provenance) {
				const otuAtSave = await getLocalOtu(
					db,
					data.referenceId,
					data.command.otuId,
				);
				const { ncbiApiKey } = await getSettings(db);
				const { apiKey } = resolveNcbiApiKey(ncbiApiKey, keyring);
				const client = createNcbiClient({ apiKey: apiKey ?? "", logger });
				const accessions = provenance.sequences.map(
					(sequence) => sequence.accession,
				);
				const records = await client.fetchGenbankRecords(accessions);
				const found = new Set(
					records.map((record) => record.accession_version.toLowerCase()),
				);
				if (
					records.length !== accessions.length ||
					accessions.some((accession) => !found.has(accession.toLowerCase()))
				) {
					throw new GenbankProvenanceError();
				}
				const taxonomy = records[0]
					? await client.fetchTaxonomyRecord(records[0].source.taxid)
					: null;
				validateGenbankIsolateSave(data.command, records, taxonomy, otuAtSave);
			}
			const otu = await createLocalOtuIsolate(db, {
				referenceId: data.referenceId,
				userId: context.principal.userId,
				command: data.command,
			});
			setResponseStatus(201);
			return otu;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateLocalOtuTaxonomyFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateLocalOtuTaxonomySchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			return await updateLocalOtuTaxonomy(db, {
				referenceId: data.referenceId,
				userId: context.principal.userId,
				command: data.command,
			});
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateLocalOtuIsolateFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateLocalOtuIsolateSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			return await updateLocalOtuIsolate(db, {
				referenceId: data.referenceId,
				userId: context.principal.userId,
				command: data.command,
			});
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const previewLocalOtuPlanFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateLocalOtuPlanSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			return await previewLocalOtuPlan(db, data.referenceId, data.command);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const updateLocalOtuPlanFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(updateLocalOtuPlanSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			return await updateLocalOtuPlan(db, {
				referenceId: data.referenceId,
				userId: context.principal.userId,
				command: data.command,
			});
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteLocalOtuFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(deleteLocalOtuSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			await deleteLocalOtu(db, {
				referenceId: data.referenceId,
				userId: context.principal.userId,
				command: data.command,
			});
			return null;
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const deleteLocalOtuIsolateFn = createServerFn({ method: "POST" })
	.middleware([authenticated()])
	.validator(deleteLocalOtuIsolateSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (
				!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
			) {
				setResponseStatus(403);
				throw new ForbiddenError();
			}
			return await deleteLocalOtuIsolate(db, {
				referenceId: data.referenceId,
				userId: context.principal.userId,
				command: data.command,
			});
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
		const actor = await resolveReferenceActor(db, context.principal.userId);
		if (
			!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
		) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}

		const accessions = Array.from(new Set(data.accessions));

		const { ncbiApiKey } = await getSettings(db);
		const { availability, apiKey } = resolveNcbiApiKey(ncbiApiKey, keyring);
		if (availability === "configuration_error") {
			logger.warn(
				{ availability },
				"stored NCBI API key could not be decrypted",
			);
		}
		const client = createNcbiClient({ apiKey: apiKey ?? "", logger });

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
			if (err instanceof GenbankMixedIsolateError) {
				return rethrowAsHttp(err);
			}
			if (err instanceof GenbankTaxonomyError) {
				return rethrowAsHttp(err);
			}
			if (err instanceof GenbankOtuEmptyError) {
				setResponseStatus(404);
				throw new ClientError("Accessions not found.", 404);
			}
			throw err;
		}
	});

/** Resolve accessions and match their records to an existing OTU plan. */
export const getGenbankIsolateDraftFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(genbankIsolateDraftSchema)
	.handler(async ({ context, data }): Promise<GenbankIsolateDraft> => {
		const actor = await resolveReferenceActor(db, context.principal.userId);
		if (
			!(await checkReferenceV2Right(db, data.referenceId, "modifyOtu", actor))
		) {
			setResponseStatus(403);
			throw new ForbiddenError();
		}

		const otu = await getLocalOtu(db, data.referenceId, data.otuId);
		const { ncbiApiKey } = await getSettings(db);
		const { availability, apiKey } = resolveNcbiApiKey(ncbiApiKey, keyring);
		if (availability === "configuration_error") {
			logger.warn(
				{ availability },
				"stored NCBI API key could not be decrypted",
			);
		}
		const records = await createNcbiClient({ apiKey: apiKey ?? "", logger })
			.fetchGenbankRecords(Array.from(new Set(data.accessions)))
			.catch((err: unknown): never => {
				if (err instanceof NcbiUnreachableError) {
					setResponseStatus(502);
					throw new ClientError("Could not reach NCBI.", 502);
				}
				throw err;
			});

		const found = new Set(
			records.flatMap((record) => [
				record.accession.toLowerCase(),
				record.accession_version.toLowerCase(),
			]),
		);
		const missing = data.accessions.filter(
			(accession) => !found.has(accession.toLowerCase()),
		);
		if (missing.length > 0 || records.length === 0) {
			setResponseStatus(404);
			throw new ClientError(
				`Accessions not found: ${(missing.length > 0 ? missing : data.accessions).join(", ")}.`,
				404,
			);
		}

		const first = records[0];
		const client = createNcbiClient({ apiKey: apiKey ?? "", logger });
		const taxonomy = first
			? await client.fetchTaxonomyRecord(first.source.taxid).catch(() => null)
			: null;
		try {
			return buildGenbankIsolateDraft(records, taxonomy, otu);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getLocalOtusFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(referenceIdSchema)
	.handler(async ({ context, data }) => {
		try {
			// An invisible Reference surfaces as a 404, never an empty list.
			const actor = await resolveReferenceActor(db, context.principal.userId);
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
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getLocalOtuOverview(db, data.referenceId, data.otuId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getLocalOtuIsolatesFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(otuReadSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getLocalOtuIsolates(db, data.referenceId, data.otuId);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getLocalOtuIsolateFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(isolateReadSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getLocalOtuIsolate(
				db,
				data.referenceId,
				data.otuId,
				data.isolateId,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});

export const getLocalOtuSequenceFn = createServerFn({ method: "GET" })
	.middleware([authenticated()])
	.validator(sequenceReadSchema)
	.handler(async ({ context, data }) => {
		try {
			const actor = await resolveReferenceActor(db, context.principal.userId);
			if (!(await checkReferenceV2Visibility(db, data.referenceId, actor))) {
				throw new ReferenceV2NotFoundError();
			}
			return await getLocalOtuSequence(
				db,
				data.referenceId,
				data.otuId,
				data.isolateId,
				data.sequenceId,
			);
		} catch (err) {
			return rethrowAsHttp(err);
		}
	});
