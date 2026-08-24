/**
 * Smoke tests against the real NCBI.
 *
 * Skipped unless `VT_NCBI_LIVE=1`, and never run in CI: they depend on NCBI
 * being up and on a rate limit shared with everything else on the runner's
 * address, so a failure here would say nothing about the change under test.
 *
 * Run with `VT_NCBI_LIVE=1 pnpm --filter @virtool/ncbi test`. Set
 * `VT_NCBI_API_KEY` to use the higher rate limit.
 *
 * These assert the *shape* NCBI still sends, not the values it sends. A taxon
 * gets renamed and a record gains a version without either being a regression;
 * what would be a regression is NCBI moving a field or changing a type, and
 * that is what these catch. The differential tests over the recorded fixtures
 * are where exact values are pinned.
 */

import { describe, expect, it } from "vitest";
import { createNcbiClient } from "./client";
import { getSpecies } from "./models";
import { logger } from "./test/logger";

const live = process.env.VT_NCBI_LIVE === "1";

const client = createNcbiClient({
	logger,
	apiKey: process.env.VT_NCBI_API_KEY ?? "",
});

describe.skipIf(!live)("live NCBI", () => {
	it("fetches a RefSeq record", async () => {
		const [record] = await client.fetchGenbankRecords(["NC_005954.1"]);

		expect(record).toMatchObject({
			accession: "NC_005954",
			accession_version: "NC_005954.1",
			moltype: "DNA",
			refseq: true,
			strandedness: "double",
			topology: "circular",
		});

		expect(record?.source.taxid).toBe(518829);
		expect(record?.sequence).toMatch(/^[ATCGRYKMSWBDHVN]+$/);
	});

	it("fetches several records in one call", async () => {
		const records = await client.fetchGenbankRecords([
			"AF395128.1",
			"NC_005954.1",
		]);

		expect(records.map((record) => record.accession)).toEqual([
			"AF395128",
			"NC_005954",
		]);
	});

	it("reads one record by accession", async () => {
		const record = await client.fetchGenbankRecord("NC_005954.1");

		expect(record?.accession_version).toBe("NC_005954.1");
		expect(record?.source.host).toBe("Okra");
	});

	it("answers null for an accession NCBI does not hold", async () => {
		await expect(client.fetchGenbankRecord("ZZ999999.9")).resolves.toBeNull();
	});

	it("returns nothing for an accession NCBI does not hold", async () => {
		await expect(client.fetchGenbankRecords(["ZZ999999.9"])).resolves.toEqual(
			[],
		);
	});

	it("fetches a taxonomy record with its lineage and names", async () => {
		const record = await client.fetchTaxonomyRecord(12242);

		expect(record).not.toBeNull();
		expect(record?.id).toBe(12242);
		expect(record?.other_names.acronym).toContain("TMV");
		expect(record?.lineage.length).toBeGreaterThan(5);
		expect(getSpecies(record as never)).toMatchObject({ rank: "species" });
	});

	it("answers null for a taxid NCBI does not hold", async () => {
		await expect(client.fetchTaxonomyRecord(999_999_999)).resolves.toBeNull();
	});

	// The subtree search is one request, but the rank of each descendant is
	// another, and the anonymous rate limit spaces them a third of a second
	// apart. A species with a dozen isolates therefore takes seconds, not
	// milliseconds.
	it("finds the descendants of a species", async () => {
		const taxids = await client.fetchDescendantTaxids(3432891);

		expect(taxids).toContain(12242);
		expect(taxids).not.toContain(3432891);
	}, 60_000);

	it("searches accessions by taxid", async () => {
		const accessions = await client.fetchAccessionsByTaxid(12242, {
			maxLength: 500,
		});

		expect(accessions.length).toBeGreaterThan(0);

		for (const accession of accessions) {
			expect(accession.key).toMatch(/^[A-Z]/);
			expect(accession.version).toBeGreaterThan(0);
		}
	});

	it("narrows a search to RefSeq", async () => {
		const accessions = await client.fetchAccessionsByTaxid(12242, {
			refSeqOnly: true,
		});

		expect(accessions.length).toBeGreaterThan(0);
		expect(accessions.every((accession) => accession.key.includes("_"))).toBe(
			true,
		);
	});
});
