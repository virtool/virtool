import { zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	BlastResultUnreadableError,
	checkBlastStatus,
	extractBlastRid,
	fetchBlastResult,
	formatBlastContent,
	NcbiBlastError,
	submitBlast,
} from "./ncbi";

afterEach(() => {
	vi.unstubAllGlobals();
});

/** The comment NCBI wraps a submission's RID in, as it appears in the page. */
const SUBMISSION_HTML = `<html><body>
<!--QBlastInfoBegin
	Status=READY
	RID = ZZ7DFGH1013
	RTOE = 26
QBlastInfoEnd
-->
</body></html>`;

function stubFetch(response: Response | (() => Response)) {
	const fetchMock = vi.fn(async () =>
		typeof response === "function" ? response() : response,
	);

	vi.stubGlobal("fetch", fetchMock);

	return fetchMock;
}

function textResponse(body: string, status = 200): Response {
	return new Response(body, { status });
}

describe("extractBlastRid", () => {
	it("reads the RID out of the QBlastInfo comment", () => {
		expect(extractBlastRid(SUBMISSION_HTML)).toBe("ZZ7DFGH1013");
	});

	it("throws when the page carries no QBlastInfo comment", () => {
		expect(() => extractBlastRid("<html>NCBI is down</html>")).toThrow(
			NcbiBlastError,
		);
	});

	it("throws when the comment carries no RID line", () => {
		expect(() =>
			extractBlastRid("<!--QBlastInfoBegin\n RTOE = 26\nQBlastInfoEnd-->"),
		).toThrow(NcbiBlastError);
	});
});

describe("submitBlast", () => {
	it("posts the sequence in the body with the parameters in the query", async () => {
		const fetchMock = stubFetch(textResponse(SUBMISSION_HTML));

		expect(await submitBlast("ATGCATGC")).toBe("ZZ7DFGH1013");

		const [url, init] = fetchMock.mock.calls[0] as unknown as [
			URL,
			RequestInit,
		];

		expect(url.origin + url.pathname).toBe(
			"https://blast.ncbi.nlm.nih.gov/Blast.cgi",
		);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			CMD: "Put",
			DATABASE: "nr",
			FILTER: "mL",
			FORMAT_TYPE: "JSON2",
			HITLIST_SIZE: "5",
			MEGABLAST: "on",
			PROGRAM: "blastn",
		});
		expect(init.method).toBe("POST");
		expect(String(init.body)).toBe("QUERY=ATGCATGC");
	});

	it("identifies itself to NCBI with a User-Agent", async () => {
		const fetchMock = stubFetch(textResponse(SUBMISSION_HTML));

		await submitBlast("ATGCATGC");

		const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];

		expect(init.headers).toEqual({ "User-Agent": "virtool" });
	});

	it("throws when NCBI refuses the submission", async () => {
		stubFetch(textResponse("too many searches", 429));

		await expect(submitBlast("ATGCATGC")).rejects.toBeInstanceOf(
			NcbiBlastError,
		);
	});

	it("throws when NCBI cannot be reached", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("fetch failed");
			}),
		);

		await expect(submitBlast("ATGCATGC")).rejects.toBeInstanceOf(
			NcbiBlastError,
		);
	});

	it("lets the caller's abort escape untranslated", async () => {
		const controller = new AbortController();

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				controller.abort();

				throw Object.assign(new Error("aborted"), { name: "AbortError" });
			}),
		);

		await expect(
			submitBlast("ATGCATGC", controller.signal),
		).rejects.not.toBeInstanceOf(NcbiBlastError);
	});
});

describe("checkBlastStatus", () => {
	it.each([
		["Status=WAITING", "waiting"],
		["Status=READY", "ready"],
		["Status=FAILED", "failed"],
		["Status=UNKNOWN", "failed"],
	])("reports %s as %s", async (body, expected) => {
		stubFetch(textResponse(`QBlastInfoBegin\n\t${body}\nQBlastInfoEnd`));

		expect(await checkBlastStatus("ZZ7DFGH1013")).toBe(expected);
	});

	it("sends the RID in the query", async () => {
		const fetchMock = stubFetch(textResponse("Status=READY"));

		await checkBlastStatus("ZZ7DFGH1013");

		const [url] = fetchMock.mock.calls[0] as unknown as [URL];

		expect(Object.fromEntries(url.searchParams)).toEqual({
			CMD: "Get",
			FORMAT_OBJECT: "SearchInfo",
			RID: "ZZ7DFGH1013",
		});
	});

	it("identifies itself to NCBI with a User-Agent", async () => {
		const fetchMock = stubFetch(textResponse("Status=READY"));

		await checkBlastStatus("ZZ7DFGH1013");

		const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];

		expect(init.headers).toEqual({ "User-Agent": "virtool" });
	});

	it("throws when NCBI refuses the check", async () => {
		stubFetch(textResponse("service unavailable", 503));

		await expect(checkBlastStatus("ZZ7DFGH1013")).rejects.toBeInstanceOf(
			NcbiBlastError,
		);
	});
});

describe("fetchBlastResult", () => {
	function zipResponse(
		members: Record<string, string>,
		status = 200,
	): Response {
		const encoder = new TextEncoder();

		const archive = zipSync(
			Object.fromEntries(
				Object.entries(members).map(([name, body]) => [
					name,
					encoder.encode(body),
				]),
			),
		);

		return new Response(archive as unknown as BodyInit, { status });
	}

	it("reads the single-query member out of the zip", async () => {
		stubFetch(
			zipResponse({ "ZZ7DFGH1013_1.json": '{"BlastOutput2":{"report":{}}}' }),
		);

		expect(await fetchBlastResult("ZZ7DFGH1013")).toEqual({
			BlastOutput2: { report: {} },
		});
	});

	it("throws a transient error when NCBI refuses the fetch", async () => {
		stubFetch(textResponse("service unavailable", 503));

		const error = await fetchBlastResult("ZZ7DFGH1013").catch((err) => err);

		expect(error).toBeInstanceOf(NcbiBlastError);
		expect(error).not.toBeInstanceOf(BlastResultUnreadableError);
		expect(error.message).toBe(
			"BLAST result fetch returned 503: service unavailable",
		);
	});

	it("throws an unreadable error when the body is not a zip", async () => {
		stubFetch(textResponse("<html>an outage page</html>"));

		await expect(fetchBlastResult("ZZ7DFGH1013")).rejects.toBeInstanceOf(
			BlastResultUnreadableError,
		);
	});

	it("throws an unreadable error when the member is not JSON", async () => {
		stubFetch(zipResponse({ "ZZ7DFGH1013_1.json": "not json" }));

		await expect(fetchBlastResult("ZZ7DFGH1013")).rejects.toBeInstanceOf(
			BlastResultUnreadableError,
		);
	});

	it("throws an unreadable error when the zip has no member for the RID", async () => {
		stubFetch(zipResponse({ "OTHER_1.json": "{}" }));

		await expect(fetchBlastResult("ZZ7DFGH1013")).rejects.toBeInstanceOf(
			BlastResultUnreadableError,
		);
	});
});

describe("formatBlastContent", () => {
	const raw = {
		BlastOutput2: {
			report: {
				program: "blastn",
				version: "BLASTN 2.15.0+",
				params: { expect: 10, gap_open: 5 },
				search_target: { db: "nr" },
				results: {
					search: {
						query_id: "Query_1",
						query_masking: [{ from: 0, to: 12 }],
						hits: [
							{
								num: 1,
								len: 1200,
								description: [
									{
										accession: "NC_003977",
										taxid: 10407,
										title: "Hepatitis B virus",
										sciname: "Hepatitis B virus",
									},
									{
										accession: "IGNORED",
										taxid: 1,
										title: "Ignored",
										sciname: "Ignored",
									},
								],
								hsps: [
									{
										align_len: 300,
										bit_score: 540.2,
										evalue: 1e-150,
										gaps: 0,
										identity: 299,
										score: 600,
									},
									{
										align_len: 1,
										bit_score: 1,
										evalue: 1,
										gaps: 1,
										identity: 1,
										score: -1,
									},
								],
							},
						],
						stat: { db_num: 100, hsp_len: 30 },
					},
				},
			},
		},
	};

	it("reduces the envelope to the seven stored keys", async () => {
		const formatted = formatBlastContent(raw);

		expect(Object.keys(formatted).sort()).toEqual([
			"hits",
			"masking",
			"params",
			"program",
			"stat",
			"target",
			"version",
		]);
		expect(formatted.program).toBe("blastn");
		expect(formatted.version).toBe("BLASTN 2.15.0+");
		expect(formatted.params).toEqual({ expect: 10, gap_open: 5 });
		expect(formatted.target).toEqual({ db: "nr" });
		expect(formatted.stat).toEqual({ db_num: 100, hsp_len: 30 });
		expect(formatted.masking).toEqual([{ from: 0, to: 12 }]);
	});

	it("reduces a hit to its first description and first HSP", async () => {
		const { hits } = formatBlastContent(raw) as {
			hits: Record<string, unknown>[];
		};

		expect(hits).toEqual([
			{
				accession: "NC_003977",
				align_len: 300,
				bit_score: 540.2,
				evalue: 1e-150,
				gaps: 0,
				identity: 299,
				len: 1200,
				name: "Hepatitis B virus",
				score: 600,
				taxid: 10407,
				title: "Hepatitis B virus",
			},
		]);
	});

	it("blanks the description fields a hit does not carry", async () => {
		const bare = structuredClone(raw);

		bare.BlastOutput2.report.results.search.hits[0].description = [
			{},
		] as unknown as (typeof raw.BlastOutput2.report.results.search.hits)[0]["description"];

		const { hits } = formatBlastContent(bare) as {
			hits: Record<string, unknown>[];
		};

		expect(hits[0]).toMatchObject({
			accession: "",
			name: "No name",
			taxid: "",
			title: "",
		});
	});

	it("stores a null masking when NCBI sends none", async () => {
		const unmasked = structuredClone(raw);

		unmasked.BlastOutput2.report.results.search.query_masking =
			undefined as unknown as (typeof raw.BlastOutput2.report.results.search)["query_masking"];

		expect(formatBlastContent(unmasked).masking).toBeNull();
	});

	it("throws on a hit whose HSP has lost a field", async () => {
		const damaged = structuredClone(raw);

		damaged.BlastOutput2.report.results.search.hits[0].hsps[0] = {
			score: 600,
		} as unknown as (typeof raw.BlastOutput2.report.results.search.hits)[0]["hsps"][0];

		expect(() => formatBlastContent(damaged)).toThrow(NcbiBlastError);
	});

	it("throws on a result carrying more than one query", async () => {
		expect(() =>
			formatBlastContent({ BlastOutput2: { report: {}, extra: {} } }),
		).toThrow(NcbiBlastError);
	});
});
