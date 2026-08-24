/**
 * Differential tests against ref-builder's Python client.
 *
 * `fixtures/expected/*.json` are ref-builder's own validated models, copied
 * from `tests/fixtures/ncbi/otus/`. `fixtures/genbank/*.xml` and
 * `fixtures/taxonomy/*.xml` are the raw NCBI responses for the same accessions
 * and taxids, recorded by `scripts/refresh-fixtures.ts`.
 *
 * ref-builder records no raw XML of its own — everything it keeps is already
 * past `Entrez.read()` — so recording the responses here is what puts the
 * XML-to-model step under test rather than only the model step.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGenbankSet } from "./genbank";
import { getSpecies } from "./models";
import { parseTaxaSet } from "./taxonomy";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** One OTU's recorded responses beside the models ref-builder derived. */
type Expected = {
	genbank: Record<string, Record<string, unknown>>;
	taxonomy: Record<string, unknown>;
};

const NAMES = readdirSync(join(FIXTURES, "expected"))
	.filter((name) => name.endsWith(".json"))
	.map((name) => name.slice(0, -".json".length))
	.sort();

function read(kind: string, name: string, extension: string): string {
	return readFileSync(join(FIXTURES, kind, `${name}.${extension}`), "utf8");
}

function readExpected(name: string): Expected {
	return JSON.parse(read("expected", name, "json")) as Expected;
}

it("has fixtures", () => {
	expect(NAMES).toHaveLength(11);
});

describe.each(NAMES)("%s", (name) => {
	it("projects genbank records the way ref-builder does", () => {
		const expected = readExpected(name);

		const rejected: string[] = [];

		const records = parseGenbankSet(read("genbank", name, "xml"), (err) => {
			rejected.push(err.message);
		});

		expect(rejected).toEqual([]);

		const byAccession = Object.fromEntries(
			records.map((record) => [record.accession_version, record]),
		);

		expect(Object.keys(byAccession).sort()).toEqual(
			Object.keys(expected.genbank).sort(),
		);

		for (const [accession, want] of Object.entries(expected.genbank)) {
			expect(byAccession[accession], accession).toEqual(want);
		}
	});

	it("projects the taxonomy record the way ref-builder does", () => {
		const expected = readExpected(name);

		const records = parseTaxaSet(read("taxonomy", name, "xml"));

		expect(records).toHaveLength(1);

		const record = records[0];

		if (record === undefined) {
			throw new Error("no record");
		}

		// ref-builder's model carries `species` as a computed field. It is a
		// function here, so it is compared separately rather than being expected
		// on the record itself.
		const { species, ...want } = expected.taxonomy;

		expect(record).toEqual(want);
		expect(getSpecies(record)).toEqual(species);
	});
});
