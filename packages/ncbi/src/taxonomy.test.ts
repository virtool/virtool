import { describe, expect, it } from "vitest";
import { getSpecies } from "./models";
import { parseTaxaSet } from "./taxonomy";

function taxaSet(body: string): string {
	return `<?xml version="1.0"?><TaxaSet>${body}</TaxaSet>`;
}

function taxon({
	id = "12242",
	name = "Tobacco mosaic virus",
	rank = "no rank",
	otherNames = "<Acronym>TMV</Acronym>",
	lineage = `<Taxon><TaxId>10239</TaxId><ScientificName>Viruses</ScientificName><Rank>acellular root</Rank></Taxon>
		<Taxon><TaxId>3432891</TaxId><ScientificName>Tobamovirus tabaci</ScientificName><Rank>species</Rank></Taxon>`,
}: {
	id?: string;
	name?: string;
	rank?: string;
	otherNames?: string;
	lineage?: string;
} = {}): string {
	return `<Taxon>
		<TaxId>${id}</TaxId>
		<ScientificName>${name}</ScientificName>
		${otherNames === "" ? "" : `<OtherNames>${otherNames}</OtherNames>`}
		<Rank>${rank}</Rank>
		${lineage === "" ? "" : `<LineageEx>${lineage}</LineageEx>`}
	</Taxon>`;
}

describe("parseTaxaSet()", () => {
	it("coerces the quoted TaxId to a number", () => {
		const [record] = parseTaxaSet(taxaSet(taxon()));

		expect(record?.id).toBe(12242);
		expect(record?.lineage[0]?.id).toBe(10239);
	});

	it("reads a single repeated element as a one-item list", () => {
		const [record] = parseTaxaSet(taxaSet(taxon()));

		expect(record?.other_names.acronym).toEqual(["TMV"]);
	});

	it("reads a repeated element occurring twice as a two-item list", () => {
		const [record] = parseTaxaSet(
			taxaSet(
				taxon({
					otherNames:
						"<EquivalentName>one</EquivalentName><EquivalentName>two</EquivalentName>",
				}),
			),
		);

		expect(record?.other_names.equivalent_name).toEqual(["one", "two"]);
	});

	it("defaults every absent name list to empty", () => {
		const [record] = parseTaxaSet(taxaSet(taxon({ otherNames: "" })));

		expect(record?.other_names).toEqual({
			acronym: [],
			genbank_acronym: [],
			equivalent_name: [],
			synonym: [],
			includes: [],
		});
	});

	it("drops the OtherNames keys this client does not read", () => {
		const [record] = parseTaxaSet(
			taxaSet(taxon({ otherNames: "<Misspelling>Tabacco</Misspelling>" })),
		);

		expect(record?.other_names).not.toHaveProperty("misspelling");
	});

	it("keeps the lineage in NCBI's order", () => {
		const [record] = parseTaxaSet(taxaSet(taxon()));

		expect(record?.lineage.map((item) => item.name)).toEqual([
			"Viruses",
			"Tobamovirus tabaci",
		]);
	});

	it("reads a set carrying several taxa", () => {
		expect(
			parseTaxaSet(taxaSet(taxon({ id: "1" }) + taxon({ id: "2" }))),
		).toHaveLength(2);
	});

	it("returns nothing when NCBI holds no such taxon", () => {
		// An unknown taxid answers with an empty body rather than an empty set.
		expect(parseTaxaSet("")).toEqual([]);
		expect(parseTaxaSet("<html><body>Error</body></html>")).toEqual([]);
	});

	it("accepts a rank above species", () => {
		// ref-builder rejects these at validation time because an OTU must be
		// species-or-below. That is a reference-building rule, not a property of
		// the record, so the client reads the rank and leaves the policy to
		// getSpecies().
		const [record] = parseTaxaSet(taxaSet(taxon({ rank: "family" })));

		expect(record?.rank).toBe("family");
	});
});

describe("getSpecies()", () => {
	it("finds the species in the lineage of a subspecific taxon", () => {
		const [record] = parseTaxaSet(taxaSet(taxon()));

		expect(record && getSpecies(record)).toEqual({
			id: 3432891,
			name: "Tobamovirus tabaci",
			rank: "species",
		});
	});

	it("answers with itself for a species-rank record", () => {
		const [record] = parseTaxaSet(
			taxaSet(
				taxon({ id: "3432891", name: "Tobamovirus tabaci", rank: "species" }),
			),
		);

		expect(record && getSpecies(record)).toEqual({
			id: 3432891,
			name: "Tobamovirus tabaci",
			rank: "species",
		});
	});

	it("returns null for a taxon above species", () => {
		const [record] = parseTaxaSet(
			taxaSet(taxon({ rank: "genus", lineage: "" })),
		);

		expect(record && getSpecies(record)).toBeNull();
	});
});
