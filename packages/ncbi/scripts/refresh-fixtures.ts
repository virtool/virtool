/**
 * Re-record the golden NCBI responses under `src/fixtures`.
 *
 * The expected models in `src/fixtures/expected` are *not* touched. They came
 * from ref-builder and are the independent baseline; regenerating them from
 * this client's own output would make the differential test compare the client
 * to itself.
 *
 * So a shape change at NCBI shows up as a failing differential test with a
 * reviewable diff, which is the point. When a failure turns out to be NCBI
 * having changed the data rather than this client having broken — a renamed
 * taxon, a lineage node retired — edit the expected file by hand and say so in
 * the commit.
 *
 * Run with `pnpm --filter @virtool/ncbi refresh-fixtures`.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"src",
	"fixtures",
);

const EUTILS_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/** Stay inside the anonymous rate limit of three requests a second. */
const INTERVAL_MS = 400;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(params: Record<string, string>): Promise<string> {
	const url = new URL(`${EUTILS_URL}/efetch.fcgi`);

	url.search = new URLSearchParams({
		...params,
		email: "dev@virtool.ca",
		tool: "virtool",
	}).toString();

	const response = await fetch(url, {
		headers: { "User-Agent": "virtool" },
		signal: AbortSignal.timeout(60_000),
	});

	if (!response.ok) {
		throw new Error(`NCBI returned ${response.status} for ${params.id}`);
	}

	return response.text();
}

const names = readdirSync(join(FIXTURES, "expected"))
	.filter((name) => name.endsWith(".json"))
	.map((name) => name.slice(0, -".json".length))
	.sort();

for (const name of names) {
	const expected = JSON.parse(
		readFileSync(join(FIXTURES, "expected", `${name}.json`), "utf8"),
	) as { genbank: Record<string, unknown>; taxonomy: { id: number } };

	const accessions = Object.keys(expected.genbank).sort();

	writeFileSync(
		join(FIXTURES, "genbank", `${name}.xml`),
		await fetchText({
			db: "nuccore",
			id: accessions.join(","),
			rettype: "gb",
			retmode: "xml",
		}),
	);

	await sleep(INTERVAL_MS);

	writeFileSync(
		join(FIXTURES, "taxonomy", `${name}.xml`),
		await fetchText({ db: "taxonomy", id: String(expected.taxonomy.id) }),
	);

	await sleep(INTERVAL_MS);

	// biome-ignore lint/suspicious/noConsole: a maintenance script run by hand, whose progress is its only output
	console.log(`${name} (${accessions.length} accessions)`);
}
