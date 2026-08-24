/**
 * The NCBI E-utilities client.
 *
 * Four call shapes cover everything Virtool asks of NCBI:
 *
 * | Call | Response |
 * | -- | -- |
 * | `esearch(nuccore, idtype=acc)` | JSON |
 * | `esearch(taxonomy, txid[Subtree])` | JSON |
 * | `efetch(taxonomy, id=taxid)` | TaxaSet XML |
 * | `efetch(nuccore, rettype=gb, retmode=xml)` | GBSet XML |
 *
 * ESearch supports `retmode=json` and EFetch does not, for any database, so
 * two of the four are typed JSON fetches and two go through the XML
 * projections in `genbank.ts` and `taxonomy.ts`.
 *
 * **NCBI's Datasets v2 API is deliberately not used for taxonomy.** It is
 * still `v2alpha`, it takes two calls — `dataset_report` for the ranked
 * lineage and `name_report` for acronyms and synonyms — to cover what one
 * `efetch(taxonomy)` returns in a single response, and it has no subtree
 * search at all, only a taxon's direct `children`. EMBL-EBI's ENA is not used
 * either: it serves INSDC accessions but rejects RefSeq ones outright, and
 * RefSeq is what Virtool's default-isolate rules are built on.
 */

import { USER_AGENT } from "@virtool/contracts/userAgent";
import type { Logger } from "@virtool/logger";
import { type Accession, filterAccessions, formatAccession } from "./accession";
import { NcbiUnreachableError, NcbiUnreadableError } from "./errors";
import { parseGenbankSet } from "./genbank";
import {
	NcbiDatabase,
	type NcbiGenbank,
	type NcbiTaxonomy,
	SUBSPECIFIC_RANKS,
} from "./models";
import {
	type EsearchPage,
	getSequenceLengthTerm,
	parseEsearch,
} from "./search";
import { parseTaxaSet } from "./taxonomy";

const EUTILS_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/**
 * NCBI asks automated callers to identify themselves; unidentified traffic is
 * throttled harder and can be blocked outright.
 */
const EMAIL = "dev@virtool.ca";
const TOOL = "virtool";

/** How long any one request may take. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The most of a body to put in an error message.
 *
 * A refusal is normally a one-line NCBI message, but a proxy or an outage page
 * in front of it can be arbitrarily large.
 */
const MAX_LOGGED_BODY = 500;

/**
 * The rate NCBI allows, as the minimum gap between two requests.
 *
 * Three requests a second anonymously and ten with an API key. The gap is
 * rounded up by a few milliseconds because NCBI measures the rate on its own
 * clock, and a caller pacing itself to exactly the limit lands over it often
 * enough to be told so.
 */
const ANONYMOUS_INTERVAL_MS = 350;
const KEYED_INTERVAL_MS = 110;

/** The number of results to ask for per page in an ESearch query. */
const ESEARCH_PAGE_SIZE = 1000;

/** The number of records to fetch per batch in an EFetch query. */
const EFETCH_BATCH_SIZE = 500;

/** How many times a request is retried before the failure is reported. */
const MAX_ATTEMPTS = 3;

/** How long to wait before the first retry. Doubled on each further attempt. */
const RETRY_BASE_MS = 500;

/** The statuses worth trying again, being NCBI's rate limit and its outages. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
	429, 500, 502, 503, 504,
]);

/** How to reach NCBI. */
export type NcbiClientOptions = {
	/**
	 * The instance's NCBI API key, which raises the E-utilities rate limit from
	 * three requests a second to ten.
	 *
	 * An empty string means no key is configured, and `api_key` is left off the
	 * query string entirely — NCBI treats a blank one as a bad key and refuses
	 * the request rather than falling back to the anonymous tier.
	 */
	apiKey?: string;
	/** Where this client's warnings go. */
	logger: Logger;
	/** The `fetch` to call, which tests replace. */
	fetch?: typeof globalThis.fetch;
};

/** How to narrow a search of NCBI Nucleotide by taxid. */
export type FetchAccessionsOptions = {
	/** The shortest sequence to return, in bases. */
	minLength?: number;
	/** The longest sequence to return, in bases. */
	maxLength?: number;
	/** Whether to return only RefSeq accessions. */
	refSeqOnly?: boolean;
	/** Aborts the underlying requests. */
	signal?: AbortSignal;
};

/** Reads nucleotide records and taxonomy from NCBI. */
export type NcbiClient = {
	fetchGenbankRecord(
		accession: string | Accession,
		signal?: AbortSignal,
	): Promise<NcbiGenbank | null>;
	fetchGenbankRecords(
		accessions: Iterable<string | Accession>,
		signal?: AbortSignal,
	): Promise<NcbiGenbank[]>;
	fetchTaxonomyRecord(
		taxid: number,
		signal?: AbortSignal,
	): Promise<NcbiTaxonomy | null>;
	fetchDescendantTaxids(
		speciesTaxid: number,
		signal?: AbortSignal,
	): Promise<number[]>;
	fetchAccessionsByTaxid(
		taxid: number,
		options?: FetchAccessionsOptions,
	): Promise<Accession[]>;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);

		function onAbort() {
			clearTimeout(timer);
			reject(signal?.reason);
		}

		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/**
 * Serialise requests and hold each one back until the rate NCBI allows has
 * elapsed since the last.
 *
 * A queue rather than a token bucket, because the limit NCBI enforces is on
 * the whole deployment: letting a burst through and paying for it with a
 * refusal is worse than waiting, since a refusal costs a request against the
 * same limit.
 */
function createLimiter(intervalMs: number) {
	let tail: Promise<unknown> = Promise.resolve();
	let last = 0;

	return function limit<T>(
		work: () => Promise<T>,
		signal?: AbortSignal,
	): Promise<T> {
		const run = tail.then(async () => {
			const wait = last + intervalMs - Date.now();

			if (wait > 0) {
				await sleep(wait, signal);
			}

			last = Date.now();

			return work();
		});

		// The chain must not break on a rejection, or every later request is
		// rejected with the first one's error.
		tail = run.then(
			() => undefined,
			() => undefined,
		);

		return run;
	};
}

/** Whether an error is the caller's abort rather than a fault of NCBI's. */
function isAborted(err: unknown, signal?: AbortSignal): boolean {
	return (
		signal?.aborted === true ||
		(err instanceof Error && err.name === "AbortError")
	);
}

export function createNcbiClient(options: NcbiClientOptions): NcbiClient {
	const { apiKey = "", logger } = options;
	const doFetch = options.fetch ?? globalThis.fetch;

	const limit = createLimiter(
		apiKey ? KEYED_INTERVAL_MS : ANONYMOUS_INTERVAL_MS,
	);

	/**
	 * Build a request URL.
	 *
	 * **The result never reaches a log or an error message.** It carries the API
	 * key, and nothing here has a scrubber in front of it.
	 */
	function buildUrl(path: string, params: Record<string, string>): URL {
		const url = new URL(`${EUTILS_URL}/${path}`);

		url.search = new URLSearchParams({
			...params,
			email: EMAIL,
			tool: TOOL,
			...(apiKey ? { api_key: apiKey } : {}),
		}).toString();

		return url;
	}

	/**
	 * Make one request, retrying a refusal NCBI may recover from.
	 *
	 * A 400 is a bad accession or a malformed term and is returned to the
	 * caller to interpret; a 429 or a 5xx is the rate limiter or an outage and
	 * is worth trying again.
	 */
	async function request(
		path: string,
		params: Record<string, string>,
		body: URLSearchParams | undefined,
		description: string,
		signal?: AbortSignal,
	): Promise<Response> {
		let lastError: unknown;

		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

			const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;

			try {
				const response = await limit(
					() =>
						doFetch(buildUrl(path, params), {
							method: body ? "POST" : "GET",
							...(body ? { body } : {}),
							headers: { "User-Agent": USER_AGENT },
							signal: combined,
						}),
					signal,
				);

				if (!RETRYABLE_STATUSES.has(response.status)) {
					return response;
				}

				lastError = new NcbiUnreachableError(
					`NCBI returned ${response.status} trying to ${description}`,
				);
			} catch (err) {
				// The caller's abort is not a fault of NCBI's. It escapes
				// untranslated so a drain stops rather than retrying three times.
				if (isAborted(err, signal)) {
					throw err;
				}

				lastError = err;
			}

			if (attempt < MAX_ATTEMPTS) {
				logger.warn({ attempt, description }, "retrying ncbi request");

				await sleep(RETRY_BASE_MS * 2 ** (attempt - 1), signal);
			}
		}

		throw new NcbiUnreachableError(`Could not reach NCBI to ${description}`, {
			cause: lastError,
		});
	}

	/** Make a request and read its body, refusing a non-200. */
	async function requestText(
		path: string,
		params: Record<string, string>,
		body: URLSearchParams | undefined,
		description: string,
		signal?: AbortSignal,
	): Promise<string> {
		const response = await request(path, params, body, description, signal);

		// `request` has returned once the headers arrive, so a stall or a
		// disconnect while the body streams rejects here, outside its retry and
		// translation. Left raw, a body-read timeout escapes as a bare
		// `TimeoutError` and surfaces as a 500 rather than the 502 an
		// unreachable NCBI should give. The caller's own abort still propagates.
		let text: string;

		try {
			text = await response.text();
		} catch (err) {
			if (isAborted(err, signal)) {
				throw err;
			}

			throw new NcbiUnreachableError(
				`NCBI disconnected while trying to ${description}`,
				{ cause: err },
			);
		}

		if (response.status !== 200) {
			throw new NcbiUnreachableError(
				`NCBI returned ${response.status} trying to ${description}: ${text.slice(0, MAX_LOGGED_BODY)}`,
			);
		}

		return text;
	}

	/** Run one ESearch page. */
	async function esearch(
		db: NcbiDatabase,
		term: string,
		retstart: number,
		retmax: number,
		extra: Record<string, string>,
		signal?: AbortSignal,
	): Promise<EsearchPage> {
		return parseEsearch(
			await requestText(
				"esearch.fcgi",
				{
					db,
					term,
					retmode: "json",
					retstart: String(retstart),
					retmax: String(retmax),
					...extra,
				},
				undefined,
				`search ${db}`,
				signal,
			),
		);
	}

	/**
	 * Get many records by accession.
	 *
	 * The result can hold fewer records than the caller asked for. NCBI sends
	 * what it has, and this client drops a record that it cannot read. One
	 * record with an unexpected `mol_type` must not lose the other 499 in the
	 * batch, so each rejection goes to the logger and the batch continues.
	 *
	 * Use {@link fetchGenbankRecord} for a single accession. It throws instead,
	 * for the reason given there.
	 */
	async function fetchGenbankRecords(
		accessions: Iterable<string | Accession>,
		signal?: AbortSignal,
	): Promise<NcbiGenbank[]> {
		const ids = [...accessions].map((accession) =>
			typeof accession === "string" ? accession : formatAccession(accession),
		);

		if (ids.length === 0) {
			return [];
		}

		const records: NcbiGenbank[] = [];

		for (let start = 0; start < ids.length; start += EFETCH_BATCH_SIZE) {
			const batch = ids.slice(start, start + EFETCH_BATCH_SIZE);

			// The accessions go in a form-encoded body rather than the query
			// string, which is NCBI's documented shape for a large `id` list —
			// five hundred accessions overrun a URL.
			const text = await requestText(
				"efetch.fcgi",
				{ db: NcbiDatabase.Nuccore, rettype: "gb", retmode: "xml" },
				new URLSearchParams({ id: batch.join(",") }),
				"fetch genbank records",
				signal,
			);

			for (const record of parseGenbankSet(text, (err) => {
				logger.warn(
					{ err: err.message },
					"discarded unreadable genbank record",
				);
			})) {
				records.push(record);
			}
		}

		if (records.length !== ids.length) {
			logger.info(
				{ requested: ids.length, returned: records.length },
				"ncbi returned a partial genbank result",
			);
		}

		return records.sort((a, b) => a.accession.localeCompare(b.accession));
	}

	/**
	 * Get one record by accession.
	 *
	 * The result is `null` when NCBI holds no such accession. The call throws
	 * {@link NcbiUnreadableError} when NCBI sends a record that this client
	 * cannot read.
	 *
	 * {@link fetchGenbankRecords} drops a record it cannot read, because one bad
	 * record must not lose the other 499 in the batch. That is wrong for a
	 * single accession. A user asked for this one record, so "NCBI does not have
	 * it" and "NCBI has it but Virtool cannot read it" are different answers,
	 * and the user must get the correct one.
	 */
	async function fetchGenbankRecord(
		accession: string | Accession,
		signal?: AbortSignal,
	): Promise<NcbiGenbank | null> {
		const id =
			typeof accession === "string" ? accession : formatAccession(accession);

		const text = await requestText(
			"efetch.fcgi",
			{ db: NcbiDatabase.Nuccore, rettype: "gb", retmode: "xml" },
			new URLSearchParams({ id }),
			"fetch a genbank record",
			signal,
		);

		const rejections: NcbiUnreadableError[] = [];

		const [record] = parseGenbankSet(text, (err) => rejections.push(err));

		if (record !== undefined) {
			return record;
		}

		const [rejection] = rejections;

		if (rejection !== undefined) {
			throw rejection;
		}

		return null;
	}

	async function fetchTaxonomyRecord(
		taxid: number,
		signal?: AbortSignal,
	): Promise<NcbiTaxonomy | null> {
		let text: string;

		try {
			text = await requestText(
				"efetch.fcgi",
				{ db: NcbiDatabase.Taxonomy, id: String(taxid) },
				undefined,
				"fetch a taxonomy record",
				signal,
			);
		} catch (err) {
			// NCBI answers an unknown taxid with a 400 rather than an empty set,
			// which is a miss rather than a fault.
			if (
				err instanceof NcbiUnreachableError &&
				/returned 400/.test(err.message)
			) {
				return null;
			}

			throw err;
		}

		const [record] = parseTaxaSet(text);

		return record ?? null;
	}

	/**
	 * Find the subspecific taxa under a species.
	 *
	 * The subtree search is one request, but it answers with every rank beneath
	 * the species and NCBI sends no rank alongside the ids. Deciding which are
	 * subspecific therefore costs one taxonomy fetch per descendant — the same
	 * shape ref-builder pays for, and the reason the rate limiter is a queue.
	 *
	 * A descendant that cannot be fetched is dropped with a warning rather than
	 * failing the whole walk: it is one isolate missing from a lineage, not a
	 * reason to lose the rest.
	 */
	async function fetchDescendantTaxids(
		speciesTaxid: number,
		signal?: AbortSignal,
	): Promise<number[]> {
		const term = `txid${speciesTaxid}[Subtree]`;

		const ids: string[] = [];

		for (let page = 0; ; page++) {
			const retstart = page * ESEARCH_PAGE_SIZE;

			const result = await esearch(
				NcbiDatabase.Taxonomy,
				term,
				retstart,
				ESEARCH_PAGE_SIZE,
				{},
				signal,
			);

			if (result.ids.length === 0) {
				break;
			}

			ids.push(...result.ids);

			if (result.count - retstart <= ESEARCH_PAGE_SIZE) {
				break;
			}
		}

		const descendants = ids
			.map((id) => Number(id))
			.filter((id) => Number.isInteger(id) && id > 0 && id !== speciesTaxid);

		const subspecific: number[] = [];

		for (const taxid of descendants) {
			const record = await fetchTaxonomyRecord(taxid, signal);

			if (record === null) {
				logger.warn({ taxid }, "could not fetch descendant taxonomy record");

				continue;
			}

			if (SUBSPECIFIC_RANKS.has(record.rank)) {
				subspecific.push(taxid);
			}
		}

		return subspecific;
	}

	async function fetchAccessionsByTaxid(
		taxid: number,
		{
			minLength = 0,
			maxLength = 0,
			refSeqOnly = false,
			signal,
		}: FetchAccessionsOptions = {},
	): Promise<Accession[]> {
		const lengthTerm = getSequenceLengthTerm(minLength, maxLength);

		const term = [
			`txid${taxid}[orgn]`,
			...(lengthTerm ? [lengthTerm] : []),
			...(refSeqOnly ? ["refseq[filter]"] : []),
		].join(" AND ");

		const ids: string[] = [];

		for (let page = 0; ; page++) {
			const retstart = page * ESEARCH_PAGE_SIZE;

			const result = await esearch(
				NcbiDatabase.Nuccore,
				term,
				retstart,
				ESEARCH_PAGE_SIZE,
				{ idtype: "acc" },
				signal,
			);

			if (result.ids.length === 0) {
				break;
			}

			ids.push(...result.ids);

			if (result.count - retstart <= ESEARCH_PAGE_SIZE) {
				break;
			}
		}

		return filterAccessions(ids);
	}

	return {
		fetchAccessionsByTaxid,
		fetchDescendantTaxids,
		fetchGenbankRecord,
		fetchGenbankRecords,
		fetchTaxonomyRecord,
	};
}

export { NcbiUnreachableError, NcbiUnreadableError };
