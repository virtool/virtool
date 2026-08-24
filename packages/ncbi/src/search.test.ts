import { describe, expect, it } from "vitest";
import { NcbiUnreadableError } from "./errors";
import { getDateTerm, getSequenceLengthTerm, parseEsearch } from "./search";

describe("parseEsearch()", () => {
	it("coerces NCBI's quoted count to a number", () => {
		expect(
			parseEsearch(
				JSON.stringify({
					esearchresult: { count: "872", idlist: ["PZ726275.1"] },
				}),
			),
		).toEqual({ count: 872, ids: ["PZ726275.1"] });
	});

	it("reads an empty result", () => {
		expect(
			parseEsearch(
				JSON.stringify({ esearchresult: { count: "0", idlist: [] } }),
			),
		).toEqual({ count: 0, ids: [] });
	});

	it("throws on a body that is not JSON", () => {
		expect(() => parseEsearch("<html>nope</html>")).toThrow(
			NcbiUnreadableError,
		);
	});

	it("throws on the ERROR envelope NCBI returns with a 200", () => {
		expect(() =>
			parseEsearch(
				JSON.stringify({
					esearchresult: { ERROR: "Invalid db name specified: notadb" },
				}),
			),
		).toThrow(/Invalid db name specified/);
	});

	it("reads a term that matched nothing as an empty result, not a refusal", () => {
		// A taxid NCBI does not hold answers 200 with a real result envelope and
		// an `errorlist`, which is a legitimate miss rather than the ERROR
		// channel above.
		expect(
			parseEsearch(
				JSON.stringify({
					esearchresult: {
						count: "0",
						idlist: [],
						errorlist: { phrasesnotfound: ["txid99999999999[orgn]"] },
					},
				}),
			),
		).toEqual({ count: 0, ids: [] });
	});

	it("throws when the result envelope is missing entirely", () => {
		expect(() => parseEsearch(JSON.stringify({ header: {} }))).toThrow(
			NcbiUnreadableError,
		);
	});
});

describe("getSequenceLengthTerm()", () => {
	it("bounds both ends", () => {
		expect(getSequenceLengthTerm(100, 2000)).toBe('"100"[SLEN] : "2000"[SLEN]');
	});

	it("bounds the lower end alone", () => {
		expect(getSequenceLengthTerm(100)).toBe('"100"[SLEN] : "99999999"[SLEN]');
	});

	it("bounds the upper end alone", () => {
		expect(getSequenceLengthTerm(0, 2000)).toBe('"0"[SLEN] : "2000"[SLEN]');
	});

	it("is empty when unbounded", () => {
		expect(getSequenceLengthTerm()).toBe("");
		expect(getSequenceLengthTerm(0, 0)).toBe("");
	});
});

describe("getDateTerm()", () => {
	it("bounds both ends", () => {
		expect(
			getDateTerm(
				"MDAT",
				new Date("2020-01-02T00:00:00Z"),
				new Date("2021-03-04T00:00:00Z"),
			),
		).toBe('"2020/01/02"[MDAT] : "2021/03/04"[MDAT]');
	});

	it("fills an open start with NCBI's sentinel", () => {
		expect(
			getDateTerm("PDAT", undefined, new Date("2021-03-04T00:00:00Z")),
		).toBe('"0001/01/01"[PDAT] : "2021/03/04"[PDAT]');
	});

	it("fills an open end with NCBI's sentinel", () => {
		expect(getDateTerm("PDAT", new Date("2020-01-02T00:00:00Z"))).toBe(
			'"2020/01/02"[PDAT] : "3000/12/31"[PDAT]',
		);
	});

	it("is empty when unbounded", () => {
		expect(getDateTerm("MDAT")).toBe("");
	});
});
