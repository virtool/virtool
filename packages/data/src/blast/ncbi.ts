/**
 * The NCBI BLAST URL API client, ported from Python's `virtool/blast/utils.py`.
 *
 * NCBI's BLAST service is asynchronous over three unrelated request shapes on
 * one CGI endpoint: a submission that answers with an HTML page, a status poll
 * that answers with a plain-text key/value block, and a result fetch that
 * answers with a zip archive. Nothing about it is a REST API and none of the
 * three answers a machine-readable error — a failure is a phrase inside a body
 * that returned 200. That is why every function here parses rather than
 * deserialises, and why the sweep that drives them backs a row off rather than
 * trusting any one exchange.
 *
 * Python's `initialize_ncbi_blast` is deliberately not ported: it is a byte-for
 * byte duplicate of `fetch_ncbi_blast_html` followed by `extract_blast_info`,
 * and nothing called it.
 */

import { readZipMember } from "@virtool/archive/zip";
import type { JsonObject, JsonValue } from "@virtool/contracts";
import { AppError } from "../errors";
import { USER_AGENT } from "../userAgent";

/** The one CGI endpoint every BLAST exchange goes through. */
const BLAST_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi";

/**
 * How long any one NCBI request may take.
 *
 * NCBI is a third party on the far side of the internet, and Python passes no
 * deadline at all — a hung connection there holds a task's lease until it
 * expires, and the reclaim then opens a second hung connection behind the
 * first. Ten seconds matches `genbank/data.ts`.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The most of a body to put in an error message.
 *
 * A refusal is normally a one-line NCBI message, but a proxy or an outage page
 * in front of it can be arbitrarily large.
 */
const MAX_LOGGED_BODY = 500;

/**
 * The submission parameters, which are Python's exactly.
 *
 * `HITLIST_SIZE` bounds what the result zip carries and so what lands in the
 * `result` column; `FORMAT_TYPE=JSON2` is what makes the result a zip of JSON
 * rather than the HTML a browser would get.
 */
const SUBMIT_PARAMS = {
	CMD: "Put",
	DATABASE: "nr",
	FILTER: "mL",
	FORMAT_TYPE: "JSON2",
	HITLIST_SIZE: "5",
	MEGABLAST: "on",
	PROGRAM: "blastn",
};

/**
 * Thrown when NCBI could not be reached, or answered something this side
 * cannot use.
 *
 * Transient by assumption: the sweep backs the row off and tries again on a
 * later pass rather than recording anything on it. A condition that will not
 * clear on its own is written to the row's `error` column instead.
 */
export class NcbiBlastError extends AppError {}

/**
 * Thrown when a result arrived but could not be unpacked into JSON.
 *
 * Distinct from {@link NcbiBlastError} because it is *not* transient — the
 * bytes NCBI holds for that RID will not become a zip on the next attempt — so
 * the sweep records it on the row and stops asking.
 */
export class BlastResultUnreadableError extends AppError {}

/** Where a search is up to, as the status poll reports it. */
export type BlastSearchStatus = "failed" | "ready" | "waiting";

function signalWithTimeout(signal?: AbortSignal): AbortSignal {
	const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

	return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

/**
 * `init` cannot carry headers or a signal: both are this function's, and a
 * caller supplying either would silently drop the `User-Agent` NCBI wants or
 * the deadline it must not run without.
 */
async function request(
	url: URL,
	init: Omit<RequestInit, "headers" | "signal">,
	signal: AbortSignal | undefined,
	description: string,
): Promise<Response> {
	let response: Response;

	try {
		response = await fetch(url, {
			...init,
			headers: { "User-Agent": USER_AGENT },
			signal: signalWithTimeout(signal),
		});
	} catch (err) {
		// The caller's signal is a drain or a fence, not a fault of NCBI's. It
		// escapes untranslated so the sweep leaves the row alone rather than
		// stamping a back-off on behalf of a runner that no longer owns it.
		if (signal?.aborted) {
			throw err;
		}

		// The deadline lands here too, and means the same thing to the caller as a
		// refused connection: NCBI did not answer.
		throw new NcbiBlastError(`Could not reach NCBI to ${description}`, {
			cause: err,
		});
	}

	return response;
}

function buildUrl(params: Record<string, string>): URL {
	const url = new URL(BLAST_URL);

	url.search = new URLSearchParams(params).toString();

	return url;
}

/**
 * Read the RID out of the HTML page a submission answers with.
 *
 * NCBI publishes no other channel for it: the RID is carried in a
 * `<!--QBlastInfoBegin ... QBlastInfoEnd-->` comment inside a page meant for a
 * browser, so this is a screen scrape and stays one. It is fragile by nature
 * and it throws in two places — a body carrying no `QBlastInfoBegin` comment,
 * and a comment carrying no `RID =` line. Neither is defended against here,
 * because the sweep's per-row back-off is what contains the fragility: a
 * throw leaves the row untouched and un-submitted, and the next pass tries
 * again against a service that has very likely recovered.
 */
export function extractBlastRid(html: string): string {
	const opened = html.split("<!--QBlastInfoBegin")[1];

	if (opened === undefined) {
		throw new NcbiBlastError("BLAST submission carried no QBlastInfo comment");
	}

	const info = opened.split("QBlastInfoEnd")[0] ?? opened;

	const match = /RID = (.+)/.exec(info);

	if (match?.[1] === undefined) {
		throw new NcbiBlastError("BLAST submission carried no RID");
	}

	return match[1].trim();
}

/**
 * Submit a nucleotide sequence to NCBI and return the RID it answers with.
 *
 * The parameters go in the query string and the sequence in a form-encoded
 * body, which is Python's shape and NCBI's documented one — the sequence is
 * unbounded and a query string is not.
 */
export async function submitBlast(
	sequence: string,
	signal?: AbortSignal,
): Promise<string> {
	const response = await request(
		buildUrl(SUBMIT_PARAMS),
		{
			method: "POST",
			body: new URLSearchParams({ QUERY: sequence }),
		},
		signal,
		"submit a search",
	);

	const body = await response.text();

	if (response.status !== 200) {
		throw new NcbiBlastError(
			`BLAST submission returned ${response.status}: ${body.slice(0, MAX_LOGGED_BODY)}`,
		);
	}

	return extractBlastRid(body);
}

/**
 * Ask NCBI where a search is up to.
 *
 * The answer is a plain-text block carrying a `Status=` line, and the three
 * values that matter are `WAITING`, `READY` and `FAILED`, with `UNKNOWN` sent
 * for an RID that has expired off NCBI's side.
 *
 * **Reporting `FAILED` and `UNKNOWN` as their own outcome is a deliberate
 * divergence from Python**, which tests only for the absence of
 * `Status=WAITING` and so treats both as ready. It then fetches a result that
 * does not exist, and the user is shown "No BLAST hits found" for a search
 * that never ran — indistinguishable from a real, empty answer, and with no
 * retry offered. Naming the failure puts the retry button back.
 */
export async function checkBlastStatus(
	rid: string,
	signal?: AbortSignal,
): Promise<BlastSearchStatus> {
	const response = await request(
		buildUrl({ CMD: "Get", FORMAT_OBJECT: "SearchInfo", RID: rid }),
		{},
		signal,
		"check a search",
	);

	const body = await response.text();

	if (response.status !== 200) {
		throw new NcbiBlastError(
			`BLAST status check returned ${response.status}: ${body.slice(0, MAX_LOGGED_BODY)}`,
		);
	}

	if (body.includes("Status=WAITING")) {
		return "waiting";
	}

	if (body.includes("Status=FAILED") || body.includes("Status=UNKNOWN")) {
		return "failed";
	}

	return "ready";
}

/**
 * Fetch a finished search's result and unpack it.
 *
 * The response is a zip carrying one JSON member per query, named `{rid}_N`;
 * every search here is submitted with a single sequence, so the member wanted
 * is always `{rid}_1.json`.
 *
 * **The HTTP status is checked, which Python does not do.** Python reads the
 * body whatever the status and hands it to a zip reader, so an NCBI refusal
 * becomes a `BadZipFile` and is recorded as "Unable to interpret NCBI result" —
 * a permanent error on the row for what was a transient outage. Checking first
 * keeps a refusal a refusal, which the sweep backs off rather than records.
 */
export async function fetchBlastResult(
	rid: string,
	signal?: AbortSignal,
): Promise<JsonObject> {
	const response = await request(
		buildUrl({
			CMD: "Get",
			FORMAT_OBJECT: "Alignment",
			FORMAT_TYPE: "JSON2",
			RID: rid,
		}),
		{},
		signal,
		"fetch a result",
	);

	if (response.status !== 200) {
		// Read as text only here. A 200 carries a zip, and decoding that as text
		// to build an error nobody throws would corrupt the archive.
		const body = await response.text();

		throw new NcbiBlastError(
			`BLAST result fetch returned ${response.status}: ${body.slice(0, MAX_LOGGED_BODY)}`,
		);
	}

	const archive = new Uint8Array(await response.arrayBuffer());

	let member: Uint8Array;

	try {
		member = readZipMember(archive, `${rid}_1.json`);
	} catch (err) {
		throw new BlastResultUnreadableError("Unable to interpret NCBI result", {
			cause: err,
		});
	}

	try {
		return JSON.parse(new TextDecoder().decode(member)) as JsonObject;
	} catch (err) {
		throw new BlastResultUnreadableError("Unable to interpret NCBI result", {
			cause: err,
		});
	}
}

function readObject(value: JsonValue | undefined, path: string): JsonObject {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new NcbiBlastError(`BLAST result has no ${path} object`);
	}

	return value;
}

function readArray(value: JsonValue | undefined, path: string): JsonValue[] {
	if (!Array.isArray(value)) {
		throw new NcbiBlastError(`BLAST result has no ${path} array`);
	}

	return value;
}

/**
 * A key Python reads by subscript rather than `.get`, so a result that has lost
 * it is a shape change rather than a hit with a blank field. Failing here backs
 * the row off and leaves it for the next pass; defaulting it would store a
 * result the SPA renders as a real, empty answer.
 */
function readRequired(
	object: JsonObject,
	key: string,
	path: string,
): JsonValue {
	const value = object[key];

	if (value === undefined) {
		throw new NcbiBlastError(`BLAST result ${path} has no ${key}`);
	}

	return value;
}

/** A key Python reads with `.get(key, "")`, so an absent one is blank. */
function readOptional(object: JsonObject, key: string): JsonValue {
	return object[key] ?? "";
}

/**
 * Reduce one of NCBI's hits to the eleven fields Virtool renders.
 *
 * The three description fields fall back to `""` and `sciname` to `"No name"`,
 * matching Python's `.get`; the six HSP fields and `len` are read straight, so
 * a hit missing one is a result shape that has changed and is worth failing on.
 *
 * Only the *first* description and the *first* HSP are read. A BLAST hit can
 * carry many of each — one description per accession sharing the sequence, one
 * HSP per aligned segment — and Virtool shows the best of each, which is the
 * one NCBI puts first.
 */
function formatBlastHit(hit: JsonObject, path: string): JsonObject {
	const description = readObject(
		readArray(hit.description, `${path} description`)[0],
		`${path} description`,
	);

	const hsp = readObject(readArray(hit.hsps, `${path} hsps`)[0], `${path} hsp`);

	return {
		accession: readOptional(description, "accession"),
		taxid: readOptional(description, "taxid"),
		title: readOptional(description, "title"),
		identity: readRequired(hsp, "identity", path),
		evalue: readRequired(hsp, "evalue", path),
		align_len: readRequired(hsp, "align_len", path),
		score: readRequired(hsp, "score", path),
		bit_score: readRequired(hsp, "bit_score", path),
		gaps: readRequired(hsp, "gaps", path),
		name: description.sciname ?? "No name",
		len: readRequired(hit, "len", path),
	};
}

/**
 * Reduce NCBI's result envelope to the seven keys Virtool stores.
 *
 * This shape is a contract with the SPA, which narrows the `result` column to
 * it in `apps/web/src/analyses/types.ts` and reads `hits[]` straight out. It is
 * also a contract with every row Python already wrote, since both writers fill
 * the same column until the cutover completes — so neither the envelope keys
 * nor the per-hit keys may be added to or renamed here alone.
 *
 * `masking` is the one key that may be absent, because Python reads it with
 * `.get`; everything else is a subscript there and a throw here.
 *
 * The two single-key assertions are Python's, and they are what rejects a
 * multi-query result: `HITLIST_SIZE` bounds the hits per query but nothing
 * bounds the queries, and a zip member carrying two would otherwise have its
 * second silently dropped.
 */
export function formatBlastContent(raw: JsonObject): JsonObject {
	if (Object.keys(raw).length !== 1) {
		throw new NcbiBlastError(
			`Unexpected BLAST result count ${Object.keys(raw).length} returned`,
		);
	}

	const outputs = readObject(raw.BlastOutput2, "BlastOutput2");

	if (Object.keys(outputs).length !== 1) {
		throw new NcbiBlastError(
			`Unexpected BLAST result count ${Object.keys(outputs).length} returned`,
		);
	}

	const report = readObject(outputs.report, "report");

	const search = readObject(
		readObject(report.results, "results").search,
		"search",
	);

	return {
		program: readRequired(report, "program", "report"),
		params: readRequired(report, "params", "report"),
		version: readRequired(report, "version", "report"),
		target: readRequired(report, "search_target", "report"),
		hits: readArray(search.hits, "hits").map((hit, index) =>
			formatBlastHit(readObject(hit, `hit ${index}`), `hit ${index}`),
		),
		stat: readRequired(search, "stat", "search"),
		masking: search.query_masking ?? null,
	};
}
