import type { Logger } from "@virtool/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNcbiClient } from "./client";
import { NcbiUnreachableError, NcbiUnreadableError } from "./errors";

const logger = {
	debug: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
} as unknown as Logger;

/** A GBSet carrying one minimal, valid record per accession. */
function gbSet(accessions: string[]): string {
	return `<?xml version="1.0"?><GBSet>${accessions
		.map(
			(accession) => `<GBSeq>
				<GBSeq_strandedness>single</GBSeq_strandedness>
				<GBSeq_moltype>RNA</GBSeq_moltype>
				<GBSeq_topology>linear</GBSeq_topology>
				<GBSeq_definition>A test record</GBSeq_definition>
				<GBSeq_primary-accession>${accession.split(".")[0]}</GBSeq_primary-accession>
				<GBSeq_accession-version>${accession}</GBSeq_accession-version>
				<GBSeq_organism>Test virus</GBSeq_organism>
				<GBSeq_feature-table><GBFeature>
					<GBFeature_key>source</GBFeature_key>
					<GBFeature_quals>
						<GBQualifier><GBQualifier_name>organism</GBQualifier_name><GBQualifier_value>Test virus</GBQualifier_value></GBQualifier>
						<GBQualifier><GBQualifier_name>mol_type</GBQualifier_name><GBQualifier_value>genomic RNA</GBQualifier_value></GBQualifier>
						<GBQualifier><GBQualifier_name>db_xref</GBQualifier_name><GBQualifier_value>taxon:12242</GBQualifier_value></GBQualifier>
					</GBFeature_quals>
				</GBFeature></GBSeq_feature-table>
				<GBSeq_sequence>atcg</GBSeq_sequence>
			</GBSeq>`,
		)
		.join("")}</GBSet>`;
}

function esearchBody(ids: string[], count = ids.length): string {
	return JSON.stringify({
		esearchresult: { count: String(count), idlist: ids },
	});
}

function ok(body: string): Response {
	return new Response(body, { status: 200 });
}

/** Record every request a client makes, answering each from `handler`. */
function createFetch(handler: (url: URL, init: RequestInit) => Response) {
	const calls: { url: URL; init: RequestInit }[] = [];

	const fetchMock = vi.fn(async (input: unknown, init: RequestInit = {}) => {
		const url = input instanceof URL ? input : new URL(String(input));

		calls.push({ url, init });

		return handler(url, init);
	});

	return { calls, fetchMock: fetchMock as unknown as typeof globalThis.fetch };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("identification", () => {
	it("sends the tool, email and User-Agent NCBI asks for", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet(["AB000048.1"])));

		await createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecords([
			"AB000048.1",
		]);

		expect(calls[0]?.url.searchParams.get("tool")).toBe("virtool");
		expect(calls[0]?.url.searchParams.get("email")).toBe("dev@virtool.ca");
		expect(calls[0]?.init.headers).toMatchObject({ "User-Agent": "virtool" });
	});

	it("omits api_key entirely when no key is configured", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet(["AB000048.1"])));

		await createNcbiClient({
			logger,
			apiKey: "",
			fetch: fetchMock,
		}).fetchGenbankRecords(["AB000048.1"]);

		// NCBI treats a blank key as a bad one and refuses the request rather
		// than falling back to the anonymous tier.
		expect(calls[0]?.url.searchParams.has("api_key")).toBe(false);
	});

	it("sends api_key when one is configured", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet(["AB000048.1"])));

		await createNcbiClient({
			logger,
			apiKey: "secret",
			fetch: fetchMock,
		}).fetchGenbankRecords(["AB000048.1"]);

		expect(calls[0]?.url.searchParams.get("api_key")).toBe("secret");
	});
});

describe("fetchGenbankRecords()", () => {
	it("makes no request for an empty list", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet([])));

		expect(
			await createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecords(
				[],
			),
		).toEqual([]);
		expect(calls).toEqual([]);
	});

	it("sends the accessions in a form-encoded body, not the query string", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet(["AB000048.1"])));

		await createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecords([
			"AB000048.1",
		]);

		expect(calls[0]?.init.method).toBe("POST");
		expect(calls[0]?.url.searchParams.has("id")).toBe(false);
		expect(String(calls[0]?.init.body)).toBe("id=AB000048.1");
	});

	it("accepts parsed accessions as well as strings", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet(["NC_004452.3"])));

		await createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecords([
			{ key: "NC_004452", version: 3 },
		]);

		expect(String(calls[0]?.init.body)).toBe("id=NC_004452.3");
	});

	it("batches a list longer than the efetch batch size", async () => {
		const accessions = Array.from(
			{ length: 501 },
			(_, index) => `AB${String(index).padStart(6, "0")}.1`,
		);

		const { calls, fetchMock } = createFetch((_url, init) =>
			ok(
				gbSet(
					(new URLSearchParams(String(init.body)).get("id") ?? "").split(","),
				),
			),
		);

		const records = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchGenbankRecords(accessions);

		expect(calls).toHaveLength(2);
		expect(records).toHaveLength(501);
	});

	it("sorts the records by accession", async () => {
		const { fetchMock } = createFetch(() =>
			ok(gbSet(["ZZ000001.1", "AA000001.1"])),
		);

		const records = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchGenbankRecords(["ZZ000001.1", "AA000001.1"]);

		expect(records.map((record) => record.accession)).toEqual([
			"AA000001",
			"ZZ000001",
		]);
	});

	it("returns the records NCBI did send when it sends fewer than asked", async () => {
		const { fetchMock } = createFetch(() => ok(gbSet(["AB000048.1"])));

		const records = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchGenbankRecords(["AB000048.1", "AB000049.1"]);

		expect(records).toHaveLength(1);
	});
});

describe("fetchGenbankRecord()", () => {
	it("reads one record", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet(["AB000048.1"])));

		const record = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchGenbankRecord("AB000048.1");

		expect(record?.accession_version).toBe("AB000048.1");
		expect(String(calls[0]?.init.body)).toBe("id=AB000048.1");
	});

	it("accepts a parsed accession", async () => {
		const { calls, fetchMock } = createFetch(() => ok(gbSet(["NC_004452.3"])));

		await createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecord({
			key: "NC_004452",
			version: 3,
		});

		expect(String(calls[0]?.init.body)).toBe("id=NC_004452.3");
	});

	it("answers null when NCBI holds no such accession", async () => {
		// NCBI answers an unknown accession with a 200 and an empty GBSet that
		// carries an error string, not with a 404.
		const { fetchMock } = createFetch(() =>
			ok(
				'<?xml version="1.0"?><GBSet>\nError: F a i l e d  t o  u n d e r s t a n d  i d :  Z Z 9 9 9 9 9 9 . 9\n</GBSet>',
			),
		);

		expect(
			await createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecord(
				"ZZ999999.9",
			),
		).toBeNull();
	});

	it("answers null for an empty GBSet", async () => {
		const { fetchMock } = createFetch(() => ok(gbSet([])));

		expect(
			await createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecord(
				"ZZ999999.9",
			),
		).toBeNull();
	});

	it("throws when NCBI sends a record that cannot be read", async () => {
		// The batch call drops such a record. A single fetch must not, because
		// the caller cannot then tell a missing accession from an unusable one.
		const { fetchMock } = createFetch(() =>
			ok(
				gbSet(["AB000048.1"]).replace(
					"<GBSeq_moltype>RNA</GBSeq_moltype>",
					"<GBSeq_moltype>protein</GBSeq_moltype>",
				),
			),
		);

		await expect(
			createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecord(
				"AB000048.1",
			),
		).rejects.toThrow(NcbiUnreadableError);
	});
});

describe("fetchTaxonomyRecord()", () => {
	const taxaSet = `<?xml version="1.0"?><TaxaSet><Taxon>
		<TaxId>12242</TaxId>
		<ScientificName>Tobacco mosaic virus</ScientificName>
		<Rank>no rank</Rank>
		<LineageEx><Taxon><TaxId>3432891</TaxId><ScientificName>Tobamovirus tabaci</ScientificName><Rank>species</Rank></Taxon></LineageEx>
	</Taxon></TaxaSet>`;

	it("reads a record", async () => {
		const { calls, fetchMock } = createFetch(() => ok(taxaSet));

		const record = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchTaxonomyRecord(12242);

		expect(record?.id).toBe(12242);
		expect(calls[0]?.url.searchParams.get("db")).toBe("taxonomy");
		expect(calls[0]?.url.searchParams.get("id")).toBe("12242");
	});

	it("answers null for a taxid NCBI refuses with a 400", async () => {
		const { fetchMock } = createFetch(
			() => new Response("bad id", { status: 400 }),
		);

		expect(
			await createNcbiClient({ logger, fetch: fetchMock }).fetchTaxonomyRecord(
				999,
			),
		).toBeNull();
	});

	it("answers null for an empty body", async () => {
		const { fetchMock } = createFetch(() => ok(""));

		expect(
			await createNcbiClient({ logger, fetch: fetchMock }).fetchTaxonomyRecord(
				999,
			),
		).toBeNull();
	});
});

describe("fetchDescendantTaxids()", () => {
	/** Answer the subtree search, then each descendant's rank in turn. */
	function createSubtreeFetch(
		ids: string[],
		ranks: Record<string, string | null>,
	) {
		return createFetch((url) => {
			if (url.pathname.endsWith("esearch.fcgi")) {
				return ok(esearchBody(ids));
			}

			const taxid = url.searchParams.get("id") as string;
			const rank = ranks[taxid];

			if (rank === null || rank === undefined) {
				return new Response("bad id", { status: 400 });
			}

			return ok(
				`<?xml version="1.0"?><TaxaSet><Taxon>
					<TaxId>${taxid}</TaxId>
					<ScientificName>Test taxon</ScientificName>
					<Rank>${rank}</Rank>
				</Taxon></TaxaSet>`,
			);
		});
	}

	it("keeps only the subspecific descendants", async () => {
		// The subtree search answers with every rank beneath the species, so the
		// ranks have to be read one at a time to tell isolates from the species
		// itself and from anything NCBI has slotted in between.
		const { calls, fetchMock } = createSubtreeFetch(
			["3432891", "12242", "12243", "99999"],
			{ "12242": "no rank", "12243": "isolate", "99999": "subspecies" },
		);

		const taxids = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchDescendantTaxids(3432891);

		expect(taxids).toEqual([12242, 12243]);
		expect(calls[0]?.url.searchParams.get("term")).toBe("txid3432891[Subtree]");
		expect(calls[0]?.url.searchParams.get("retmode")).toBe("json");
	});

	it("never asks about the species itself", async () => {
		const { calls, fetchMock } = createSubtreeFetch(["3432891", "12242"], {
			"12242": "isolate",
		});

		await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchDescendantTaxids(3432891);

		expect(
			calls.filter((call) => call.url.searchParams.get("id") === "3432891"),
		).toEqual([]);
	});

	it("drops a descendant whose record cannot be fetched", async () => {
		const { fetchMock } = createSubtreeFetch(["12242", "12243"], {
			"12242": "isolate",
			"12243": null,
		});

		expect(
			await createNcbiClient({
				logger,
				fetch: fetchMock,
			}).fetchDescendantTaxids(3432891),
		).toEqual([12242]);
	});

	it("answers with nothing for a species that has no descendants", async () => {
		const { calls, fetchMock } = createSubtreeFetch([], {});

		expect(
			await createNcbiClient({
				logger,
				fetch: fetchMock,
			}).fetchDescendantTaxids(3432891),
		).toEqual([]);

		expect(calls).toHaveLength(1);
	});
});

describe("fetchAccessionsByTaxid()", () => {
	it("searches by organism and asks for accessions", async () => {
		const { calls, fetchMock } = createFetch(() =>
			ok(esearchBody(["AF395128.1"])),
		);

		const accessions = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchAccessionsByTaxid(12242);

		expect(accessions).toEqual([{ key: "AF395128", version: 1 }]);
		expect(calls[0]?.url.searchParams.get("term")).toBe("txid12242[orgn]");
		expect(calls[0]?.url.searchParams.get("idtype")).toBe("acc");
	});

	it("adds the length and refseq filters to the term", async () => {
		const { calls, fetchMock } = createFetch(() => ok(esearchBody([])));

		await createNcbiClient({ logger, fetch: fetchMock }).fetchAccessionsByTaxid(
			12242,
			{ minLength: 100, maxLength: 2000, refSeqOnly: true },
		);

		expect(calls[0]?.url.searchParams.get("term")).toBe(
			'txid12242[orgn] AND "100"[SLEN] : "2000"[SLEN] AND refseq[filter]',
		);
	});

	it("drops entries that are not accessions", async () => {
		const { fetchMock } = createFetch(() =>
			ok(esearchBody(["AF395128.1", "not-an-accession"])),
		);

		expect(
			await createNcbiClient({
				logger,
				fetch: fetchMock,
			}).fetchAccessionsByTaxid(12242),
		).toEqual([{ key: "AF395128", version: 1 }]);
	});

	it("pages until every result has been read", async () => {
		const page1 = Array.from(
			{ length: 1000 },
			(_, index) => `AA${String(index).padStart(6, "0")}.1`,
		);

		const { calls, fetchMock } = createFetch((url) =>
			ok(
				url.searchParams.get("retstart") === "0"
					? esearchBody(page1, 1001)
					: esearchBody(["ZZ000001.1"], 1001),
			),
		);

		const accessions = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchAccessionsByTaxid(12242);

		expect(calls).toHaveLength(2);
		expect(accessions).toHaveLength(1001);
	});

	it("stops paging when a page comes back empty", async () => {
		const { calls, fetchMock } = createFetch(() => ok(esearchBody([], 5000)));

		await createNcbiClient({ logger, fetch: fetchMock }).fetchAccessionsByTaxid(
			12242,
		);

		expect(calls).toHaveLength(1);
	});
});

describe("failure handling", () => {
	it("retries a 429 and returns the eventual success", async () => {
		let attempts = 0;

		const { fetchMock } = createFetch(() => {
			attempts++;

			return attempts < 3
				? new Response("slow down", { status: 429 })
				: ok(gbSet(["AB000048.1"]));
		});

		const records = await createNcbiClient({
			logger,
			fetch: fetchMock,
		}).fetchGenbankRecords(["AB000048.1"]);

		expect(attempts).toBe(3);
		expect(records).toHaveLength(1);
	});

	it("gives up on a persistent 503", async () => {
		const { calls, fetchMock } = createFetch(
			() => new Response("down", { status: 503 }),
		);

		await expect(
			createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecords([
				"AB000048.1",
			]),
		).rejects.toThrow(NcbiUnreachableError);

		expect(calls).toHaveLength(3);
	});

	it("does not retry a 400, which no later attempt settles", async () => {
		const { calls, fetchMock } = createFetch(
			() => new Response("bad accession", { status: 400 }),
		);

		await expect(
			createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecords([
				"AB000048.1",
			]),
		).rejects.toThrow(NcbiUnreachableError);

		expect(calls).toHaveLength(1);
	});

	it("reports a refusal NCBI sends with a 200 rather than an empty result", async () => {
		const { fetchMock } = createFetch(() =>
			ok(JSON.stringify({ esearchresult: { ERROR: "Invalid db name" } })),
		);

		await expect(
			createNcbiClient({ logger, fetch: fetchMock }).fetchDescendantTaxids(1),
		).rejects.toThrow(NcbiUnreadableError);
	});

	it("lets the caller's abort escape untranslated", async () => {
		const controller = new AbortController();

		const { fetchMock } = createFetch(() => {
			controller.abort();

			throw new DOMException("aborted", "AbortError");
		});

		await expect(
			createNcbiClient({ logger, fetch: fetchMock }).fetchGenbankRecords(
				["AB000048.1"],
				controller.signal,
			),
		).rejects.not.toThrow(NcbiUnreachableError);
	});
});

describe("rate limiting", () => {
	it("spaces anonymous requests at NCBI's three-per-second limit", async () => {
		const at: number[] = [];

		const { fetchMock } = createFetch(() => {
			at.push(Date.now());

			return ok(esearchBody([]));
		});

		const client = createNcbiClient({ logger, fetch: fetchMock });

		await Promise.all([
			client.fetchDescendantTaxids(1),
			client.fetchDescendantTaxids(2),
			client.fetchDescendantTaxids(3),
		]);

		expect(at).toHaveLength(3);
		expect((at.at(-1) as number) - (at[0] as number)).toBeGreaterThanOrEqual(
			600,
		);
	});

	it("spaces keyed requests more tightly", async () => {
		const at: number[] = [];

		const { fetchMock } = createFetch(() => {
			at.push(Date.now());

			return ok(esearchBody([]));
		});

		const client = createNcbiClient({
			logger,
			apiKey: "secret",
			fetch: fetchMock,
		});

		await Promise.all([
			client.fetchDescendantTaxids(1),
			client.fetchDescendantTaxids(2),
			client.fetchDescendantTaxids(3),
		]);

		const elapsed = (at.at(-1) as number) - (at[0] as number);

		expect(elapsed).toBeGreaterThanOrEqual(200);
		expect(elapsed).toBeLessThan(600);
	});

	it("keeps serving later requests after one fails", async () => {
		let calls = 0;

		const { fetchMock } = createFetch(() => {
			calls++;

			return calls === 1
				? new Response("bad", { status: 400 })
				: ok(esearchBody(["AF395128.1"]));
		});

		const client = createNcbiClient({ logger, fetch: fetchMock });

		await expect(client.fetchAccessionsByTaxid(1)).rejects.toThrow();

		// A rejection must not poison the limiter's queue for everything behind
		// it.
		expect(await client.fetchAccessionsByTaxid(2)).toEqual([
			{ key: "AF395128", version: 1 },
		]);
	});
});
