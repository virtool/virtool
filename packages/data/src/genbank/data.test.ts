import type { Logger } from "@virtool/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GenbankUnreachableError, getGenbank } from "./data";

const logger = {
	debug: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
} as unknown as Logger;

// A real AB000048 record, its sequence and CDS translation trimmed. Its
// definition wraps onto a second line and its source feature carries
// `/lab_host` but no `/host`.
const LAB_HOST_RECORD = `LOCUS       AB000048                2007 bp    DNA     linear   VRL 14-JUL-2009
DEFINITION  Feline panleukopenia virus gene for nonstructural protein 1,
            complete cds, isolate: 483.
ACCESSION   AB000048
VERSION     AB000048.1
KEYWORDS    .
SOURCE      Feline panleukopenia virus
  ORGANISM  Feline panleukopenia virus
            Viruses; Floreoviria; Shotokuvirae; Cossaviricota; Quintoviricetes;
            Piccovirales; Parvoviridae; Parvovirinae; Protoparvovirus;
            Protoparvovirus carnivoran1.
REFERENCE   1
  AUTHORS   Horiuchi,M.
  TITLE     Evolutionary pattern of feline panleukopenia virus differs from
            that of canine parvovirus
  JOURNAL   Unpublished
FEATURES             Location/Qualifiers
     source          1..2007
                     /organism="Feline panleukopenia virus"
                     /mol_type="genomic DNA"
                     /isolate="483"
                     /db_xref="taxon:10786"
                     /lab_host="Felis domesticus"
     CDS             1..2007
                     /codon_start=1
                     /product="nonstructural protein 1"
                     /protein_id="BAA19009.1"
                     /translation="MSGNQYTEEVMEGVNWLKKHAEDEAFSFVFKCDNVQLNGKDVRW
                     NNYTKPIQNEELTSLIRGAQTAMDQTEEEEMDWESEVDSLAKKQVQTFDALIKKCLFE"
ORIGIN
        1 atgtctggca accagtatac tgaggaagtt atggagggag taaattggtt aaagaaacat
       61 gcagaggatg aagcgttttc atttgttttt aaatgtgaca acgtccaact aaatggaaag
//
`;

// A real NC_045512 record, trimmed. Its source feature carries `/host`, and
// its `/organism` value wraps onto a continuation line.
const HOST_RECORD = `LOCUS       NC_045512              29903 bp    ss-RNA  linear   VRL 18-JUL-2020
DEFINITION  Severe acute respiratory syndrome coronavirus 2 isolate Wuhan-Hu-1,
            complete genome.
ACCESSION   NC_045512
VERSION     NC_045512.2
DBLINK      BioProject: PRJNA485481
KEYWORDS    RefSeq.
SOURCE      Severe acute respiratory syndrome coronavirus 2
FEATURES             Location/Qualifiers
     source          1..29903
                     /organism="Severe acute respiratory syndrome coronavirus
                     2"
                     /mol_type="genomic RNA"
                     /isolate="Wuhan-Hu-1"
                     /host="Homo sapiens"
                     /db_xref="taxon:2697049"
                     /geo_loc_name="China"
                     /collection_date="Dec-2019"
     5'UTR           1..265
ORIGIN
        1 attaaaggtt tataccttcc caggtaacaa accaaccaac tttcgatctc ttgtagatct
       61 gttctctaaa cgaactttaa aatctgtgtg gctgtcactc ggctgcatgc ttagtgcact
//
`;

const WRAPPED_HOST_RECORD = `LOCUS       TEST0001                  24 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  Test virus, complete genome.
ACCESSION   TEST0001
VERSION     TEST0001.3
FEATURES             Location/Qualifiers
     source          1..24
                     /organism="Test virus"
                     /host="Solanum lycopersicum cultivar Moneymaker grown
                     under glass"
                     /db_xref="taxon:1"
ORIGIN
        1 acgtacgtac gtacgtacgt acgt
//
`;

const TWO_SOURCES_BOTH_HOSTS = `LOCUS       TEST0002                  24 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  Two source features, both with a host.
ACCESSION   TEST0002
VERSION     TEST0002.1
FEATURES             Location/Qualifiers
     source          1..12
                     /organism="First organism"
                     /host="First host"
     source          13..24
                     /organism="Second organism"
                     /host="Second host"
ORIGIN
        1 acgtacgtac gtacgtacgt acgt
//
`;

const TWO_SOURCES_LAST_HOSTLESS = `LOCUS       TEST0003                  24 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  Two source features, the last without a host.
ACCESSION   TEST0003
VERSION     TEST0003.1
FEATURES             Location/Qualifiers
     source          1..12
                     /organism="First organism"
                     /host="First host"
     source          13..24
                     /organism="Second organism"
ORIGIN
        1 acgtacgtac gtacgtacgt acgt
//
`;

const NO_VERSION_RECORD = `LOCUS       LOCUSNAME                 24 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  A record with no VERSION line.
ACCESSION   ACCNUM01
FEATURES             Location/Qualifiers
     source          1..24
                     /organism="Test virus"
ORIGIN
        1 acgtacgtac gtacgtacgt acgt
//
`;

const LOCUS_ONLY_RECORD = `LOCUS       LOCUSONLY                 24 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  A record with neither VERSION nor ACCESSION.
FEATURES             Location/Qualifiers
     source          1..24
                     /organism="Test virus"
ORIGIN
        1 acgtacgtac gtacgtacgt acgt
//
`;

const ESCAPED_QUOTES_RECORD = `LOCUS       TEST0004                  24 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  A host value containing doubled quotes.
ACCESSION   TEST0004
VERSION     TEST0004.1
FEATURES             Location/Qualifiers
     source          1..24
                     /organism="Test virus"
                     /host="Homo ""sapiens"" here"
ORIGIN
        1 acgtacgtac gtacgtacgt acgt
//
`;

const BASE_COUNT_RECORD = `LOCUS       TEST0005                  24 bp    DNA     linear   VRL 01-JAN-2020
DEFINITION  A record with a BASE COUNT line between FEATURES and ORIGIN.
ACCESSION   TEST0005
VERSION     TEST0005.1
FEATURES             Location/Qualifiers
     source          1..24
                     /organism="Test virus"
                     /host="Homo sapiens"
BASE COUNT       12 a      6 c      6 g      0 t
ORIGIN
        1 acgtacgtac gtacgtacgt acgt
//
`;

function mockFetch(body: string, status = 200) {
	const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status }));

	vi.stubGlobal("fetch", fetchMock);

	return fetchMock;
}

function firstCall(calls: unknown[][]): unknown[] {
	const [call] = calls;

	if (!call) {
		throw new Error("expected a call");
	}

	return call;
}

function requestUrl(fetchMock: ReturnType<typeof mockFetch>): URL {
	return new URL(String(firstCall(fetchMock.mock.calls)[0]));
}

describe("getGenbank", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("the request", () => {
		it("calls the NCBI efetch endpoint with the parameters Python sends", async () => {
			const fetchMock = mockFetch(HOST_RECORD);

			await getGenbank(logger, "NC_045512");

			expect(fetchMock).toHaveBeenCalledTimes(1);

			const url = requestUrl(fetchMock);

			expect(url.origin + url.pathname).toBe(
				"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
			);

			expect(Object.fromEntries(url.searchParams)).toEqual({
				db: "nuccore",
				email: "dev@virtool.ca",
				id: "NC_045512",
				retmode: "text",
				rettype: "gb",
				tool: "virtool",
			});
		});

		it("identifies itself to NCBI with a User-Agent", async () => {
			const fetchMock = mockFetch(HOST_RECORD);

			await getGenbank(logger, "NC_045512");

			const [, init] = firstCall(fetchMock.mock.calls) as [URL, RequestInit];

			expect(init.headers).toEqual({ "User-Agent": "virtool" });
		});

		it("encodes an accession that needs escaping", async () => {
			const fetchMock = mockFetch(HOST_RECORD);

			await getGenbank(logger, "NC_045512 2");

			const url = requestUrl(fetchMock);

			expect(url.searchParams.get("id")).toBe("NC_045512 2");
			expect(url.search).toContain("id=NC_045512+2");
		});
	});

	describe("parsing", () => {
		it("parses a record whose source feature carries a host", async () => {
			mockFetch(HOST_RECORD);

			await expect(getGenbank(logger, "NC_045512")).resolves.toEqual({
				accession: "NC_045512.2",
				definition:
					"Severe acute respiratory syndrome coronavirus 2 isolate Wuhan-Hu-1, complete genome",
				host: "Homo sapiens",
				sequence:
					"ATTAAAGGTTTATACCTTCCCAGGTAACAAACCAACCAACTTTCGATCTCTTGTAGATCT" +
					"GTTCTCTAAACGAACTTTAAAATCTGTGTGGCTGTCACTCGGCTGCATGCTTAGTGCACT",
			});
		});

		it("unwraps a multi-line definition and drops its trailing period", async () => {
			mockFetch(LAB_HOST_RECORD);

			const genbank = await getGenbank(logger, "AB000048");

			expect(genbank?.definition).toBe(
				"Feline panleukopenia virus gene for nonstructural protein 1, complete cds, isolate: 483",
			);
		});

		it("leaves a definition without a trailing period alone", async () => {
			mockFetch(HOST_RECORD.replace("complete genome.", "complete genome"));

			const genbank = await getGenbank(logger, "NC_045512");

			expect(genbank?.definition).toBe(
				"Severe acute respiratory syndrome coronavirus 2 isolate Wuhan-Hu-1, complete genome",
			);
		});

		it("drops only one trailing period", async () => {
			mockFetch(HOST_RECORD.replace("complete genome.", "complete genome.."));

			const genbank = await getGenbank(logger, "NC_045512");

			expect(genbank?.definition).toBe(
				"Severe acute respiratory syndrome coronavirus 2 isolate Wuhan-Hu-1, complete genome.",
			);
		});

		it("prefers the VERSION value over the ACCESSION value", async () => {
			mockFetch(LAB_HOST_RECORD);

			const genbank = await getGenbank(logger, "AB000048");

			expect(genbank?.accession).toBe("AB000048.1");
		});

		it("takes the first token of a VERSION line that also carries a GI", async () => {
			mockFetch(
				LAB_HOST_RECORD.replace(
					"VERSION     AB000048.1",
					"VERSION     AB000048.1  GI:1685500",
				),
			);

			const genbank = await getGenbank(logger, "AB000048");

			expect(genbank?.accession).toBe("AB000048.1");
		});

		it("falls back to ACCESSION when there is no VERSION line", async () => {
			mockFetch(NO_VERSION_RECORD);

			const genbank = await getGenbank(logger, "ACCNUM01");

			expect(genbank?.accession).toBe("ACCNUM01");
		});

		it("falls back to the LOCUS name when there is neither VERSION nor ACCESSION", async () => {
			mockFetch(LOCUS_ONLY_RECORD);

			const genbank = await getGenbank(logger, "LOCUSONLY");

			expect(genbank?.accession).toBe("LOCUSONLY");
		});

		it("upper-cases the lower-case ORIGIN block and drops its numbering", async () => {
			mockFetch(WRAPPED_HOST_RECORD);

			const genbank = await getGenbank(logger, "TEST0001");

			expect(genbank?.sequence).toBe("ACGTACGTACGTACGTACGTACGT");
		});

		it("preserves ambiguity codes in the sequence", async () => {
			mockFetch(
				WRAPPED_HOST_RECORD.replace(
					"        1 acgtacgtac gtacgtacgt acgt",
					"        1 acgtRYknnn nnacgtacgt acgt",
				),
			);

			const genbank = await getGenbank(logger, "TEST0001");

			expect(genbank?.sequence).toBe("ACGTRYKNNNNNACGTACGTACGT");
		});

		it("ignores a BASE COUNT line between the feature table and ORIGIN", async () => {
			mockFetch(BASE_COUNT_RECORD);

			const genbank = await getGenbank(logger, "TEST0005");

			expect(genbank?.host).toBe("Homo sapiens");
			expect(genbank?.sequence).toBe("ACGTACGTACGTACGTACGTACGT");
		});

		it("parses a record with carriage returns", async () => {
			mockFetch(HOST_RECORD.replaceAll("\n", "\r\n"));

			const genbank = await getGenbank(logger, "NC_045512");

			expect(genbank?.accession).toBe("NC_045512.2");
			expect(genbank?.host).toBe("Homo sapiens");
			expect(genbank?.sequence).toHaveLength(120);
		});

		it("throws when a 200 response is not a GenBank record", async () => {
			mockFetch("<html><body>Service unavailable</body></html>");

			await expect(getGenbank(logger, "NC_045512")).rejects.toThrow(
				"Could not parse GenBank record",
			);
		});
	});

	describe("the host qualifier", () => {
		it("is empty when the source feature has none", async () => {
			mockFetch(LAB_HOST_RECORD);

			const genbank = await getGenbank(logger, "AB000048");

			expect(genbank?.host).toBe("");
		});

		it("does not match /lab_host", async () => {
			mockFetch(LAB_HOST_RECORD);

			const genbank = await getGenbank(logger, "AB000048");

			expect(genbank?.host).not.toBe("Felis domesticus");
		});

		it("joins a value wrapped over a continuation line with a single space", async () => {
			mockFetch(WRAPPED_HOST_RECORD);

			const genbank = await getGenbank(logger, "TEST0001");

			expect(genbank?.host).toBe(
				"Solanum lycopersicum cultivar Moneymaker grown under glass",
			);
		});

		it("takes the last source feature when several carry a host", async () => {
			mockFetch(TWO_SOURCES_BOTH_HOSTS);

			const genbank = await getGenbank(logger, "TEST0002");

			expect(genbank?.host).toBe("Second host");
		});

		it("is cleared when the last source feature carries no host", async () => {
			mockFetch(TWO_SOURCES_LAST_HOSTLESS);

			const genbank = await getGenbank(logger, "TEST0003");

			expect(genbank?.host).toBe("");
		});

		it("unescapes doubled quotes", async () => {
			mockFetch(ESCAPED_QUOTES_RECORD);

			const genbank = await getGenbank(logger, "TEST0004");

			expect(genbank?.host).toBe('Homo "sapiens" here');
		});

		it("is not read from a non-source feature", async () => {
			mockFetch(
				WRAPPED_HOST_RECORD.replace(
					"     source          1..24",
					"     CDS             1..24",
				),
			);

			const genbank = await getGenbank(logger, "TEST0001");

			expect(genbank?.host).toBe("");
		});

		it("survives a preceding wrapped translation qualifier", async () => {
			mockFetch(
				LAB_HOST_RECORD.replace(
					'                     /lab_host="Felis domesticus"',
					'                     /host="Felis domesticus"',
				),
			);

			const genbank = await getGenbank(logger, "AB000048");

			expect(genbank?.host).toBe("Felis domesticus");
		});
	});

	describe("failures", () => {
		it("returns null when NCBI cannot retrieve the sequence", async () => {
			mockFetch("Error: Failed to retrieve sequence: NOPE00000\n", 400);

			await expect(getGenbank(logger, "NOPE00000")).resolves.toBeNull();
		});

		it("does not warn about an expected retrieval failure", async () => {
			mockFetch("Error: Failed to retrieve sequence: NOPE00000\n", 400);

			await getGenbank(logger, "NOPE00000");

			expect(logger.warn).not.toHaveBeenCalled();
		});

		it("warns about an unexpected non-200 response and returns null", async () => {
			mockFetch("Bad gateway", 502);

			await expect(getGenbank(logger, "NC_045512")).resolves.toBeNull();

			expect(logger.warn).toHaveBeenCalledWith(
				expect.objectContaining({
					accession: "NC_045512",
					body: "Bad gateway",
					status: 502,
				}),
				"unexpected genbank error",
			);
		});

		it("truncates a long body before logging it", async () => {
			mockFetch("x".repeat(5000), 500);

			await getGenbank(logger, "NC_045512");

			expect(firstCall(vi.mocked(logger.warn).mock.calls)[0]).toMatchObject({
				body: "x".repeat(500),
			});
		});

		it("throws GenbankUnreachableError when the request fails", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
			);

			await expect(getGenbank(logger, "NC_045512")).rejects.toThrow(
				GenbankUnreachableError,
			);
		});

		it("carries the message the Python API surfaced for an unreachable NCBI", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
			);

			await expect(getGenbank(logger, "NC_045512")).rejects.toThrow(
				"Could not reach NCBI",
			);
		});

		it("names the error class so a handler can match on it", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
			);

			await expect(getGenbank(logger, "NC_045512")).rejects.toMatchObject({
				name: "GenbankUnreachableError",
			});
		});
	});
});
