import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIndexArtifact } from "./create";
import {
	IndexArtifactFormatError,
	IndexArtifactMissingError,
	IndexOtuIntegrityError,
	IndexReferenceNotFoundError,
	IndexSequenceNotFoundError,
} from "./errors";
import golden from "./fixtures/golden.json" with { type: "json" };
import {
	type IndexOtu,
	type IndexSequence,
	openWorkflowIndex,
	type WorkflowIndex,
	writeFasta,
} from "./queries";
import {
	createIndexArtifactSchema,
	REFERENCE_SQLITE_FILE_NAME,
} from "./schema";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const FIXTURE_PATH = join(FIXTURES, REFERENCE_SQLITE_FILE_NAME);

let workPath: string;
let index: WorkflowIndex;

beforeEach(async () => {
	workPath = await mkdtemp(join(tmpdir(), "vt-index-"));
	index = openWorkflowIndex({ id: 1, path: FIXTURE_PATH });
});

afterEach(async () => {
	index.close();
	await rm(workPath, { recursive: true, force: true });
});

async function collect<T>(iterator: AsyncIterable<T>): Promise<T[]> {
	const items: T[] = [];

	for await (const item of iterator) {
		items.push(item);
	}

	return items;
}

describe("openWorkflowIndex", () => {
	it("throws a named error when the artifact is missing", () => {
		expect(() =>
			openWorkflowIndex({
				id: 12,
				path: join(workPath, "absent.sqlite"),
				storageKey: "indexes/12/abc",
			}),
		).toThrow(IndexArtifactMissingError);
	});

	it("names the index id and storage key in the missing error", () => {
		expect(() =>
			openWorkflowIndex({
				id: 12,
				path: join(workPath, "absent.sqlite"),
				storageKey: "indexes/12/abc",
			}),
		).toThrow(/index 12 .*storage key indexes\/12\/abc/);
	});

	it("throws when the file is not an artifact at all", async () => {
		const path = join(workPath, "not.sqlite");

		await writeFile(path, "definitely not sqlite");

		expect(() => openWorkflowIndex({ id: 1, path })).toThrow(
			IndexArtifactMissingError,
		);
	});

	it("reports both the expected and found version on a mismatch", async () => {
		const path = join(workPath, "future.sqlite");
		const database = new DatabaseSync(path);

		database.exec("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT)");
		database
			.prepare("INSERT INTO metadata VALUES (?, ?), (?, ?)")
			.run("format", "virtool-reference-sqlite", "format_version", "2");
		database.close();

		expect(() => openWorkflowIndex({ id: 1, path })).toThrow(
			IndexArtifactFormatError,
		);
		expect(() => openWorkflowIndex({ id: 1, path })).toThrow(
			/Expected format_version=1 but found format_version=2/,
		);
	});

	it("reports a missing metadata table", async () => {
		const path = join(workPath, "empty.sqlite");
		const database = new DatabaseSync(path);

		database.exec("CREATE TABLE unrelated (a TEXT)");
		database.close();

		expect(() => openWorkflowIndex({ id: 1, path })).toThrow(
			/Expected a readable metadata table but found none/,
		);
	});
});

describe("getReferenceMetadata", () => {
	it("matches Python", async () => {
		expect(await index.getReferenceMetadata()).toEqual(
			golden.referenceMetadata,
		);
	});

	it("throws when the artifact holds no reference", async () => {
		const path = join(workPath, "no-reference.sqlite");

		await createIndexArtifact(path, null, golden.otus as IndexOtu[]);

		const headless = openWorkflowIndex({ id: 2, path });

		await expect(headless.getReferenceMetadata()).rejects.toThrow(
			IndexReferenceNotFoundError,
		);

		headless.close();
	});
});

describe("iterSequences", () => {
	it("matches Python, ordered by sequence id", async () => {
		expect(await collect(index.iterSequences())).toEqual(golden.sequences);
	});
});

describe("iterDefaultSequences", () => {
	it("matches Python, and excludes non-default isolates", async () => {
		const sequences = await collect(index.iterDefaultSequences());

		expect(sequences).toEqual(golden.defaultSequences);
		expect(sequences.map((sequence) => sequence.isolate_id)).not.toContain(
			"iso_b",
		);
	});

	it("reports the isolate's virtool id, not its rowid", async () => {
		const sequences = await collect(index.iterDefaultSequences());

		for (const sequence of sequences) {
			expect(typeof sequence.isolate_id).toBe("string");
		}
	});
});

describe("iterOtuSequences", () => {
	it("matches Python for a set of OTU ids", async () => {
		expect(
			await collect(index.iterOtuSequences(golden.otuSequences.otuIds)),
		).toEqual(golden.otuSequences.result);
	});

	it("accepts a single OTU id", async () => {
		const sequences = await collect(index.iterOtuSequences("otu_zeta"));

		expect(sequences.map((sequence) => sequence.id)).toEqual(["seq_z1"]);
	});

	it("yields nothing for an empty set", async () => {
		expect(await collect(index.iterOtuSequences([]))).toEqual([]);
	});
});

describe("iterOtus", () => {
	it("matches Python, including the nested insertion order", async () => {
		expect(await collect(index.iterOtus())).toEqual(golden.otus);
	});

	it("throws when an isolate has no sequences", async () => {
		const path = join(workPath, "hollow.sqlite");

		// Written row by row rather than through `createIndexArtifact`, which
		// refuses to produce this. The guard here is for an artifact that arrived
		// from somewhere else — the other implementation, or a build predating that
		// refusal.
		const database = createIndexArtifactSchema(path);

		database
			.prepare(
				`INSERT INTO otus (id, reference_id, abbreviation, name, taxid, version)
					VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run("otu_hollow", null, "", "Hollow virus", null, 0);

		database
			.prepare(
				`INSERT INTO isolates (virtool_id, otu_id, source_type, source_name, is_default)
					VALUES (?, ?, ?, ?, ?)`,
			)
			.run("iso_hollow", "otu_hollow", "isolate", "H1", 1);

		database.close();

		const hollow = openWorkflowIndex({ id: 3, path });

		await expect(collect(hollow.iterOtus())).rejects.toThrow(
			IndexOtuIntegrityError,
		);

		hollow.close();
	});
});

describe("getOtuRefsBySequenceIds", () => {
	it("matches Python", async () => {
		expect(
			await index.getOtuRefsBySequenceIds(
				golden.otuRefsBySequenceId.sequenceIds,
			),
		).toEqual(golden.otuRefsBySequenceId.result);
	});

	it("returns an empty mapping for no ids", async () => {
		expect(await index.getOtuRefsBySequenceIds([])).toEqual({});
	});

	it("throws on an unknown sequence id", async () => {
		await expect(
			index.getOtuRefsBySequenceIds(["seq_a1", "seq_nope"]),
		).rejects.toThrow(IndexSequenceNotFoundError);
	});

	it("names the missing ids", async () => {
		await expect(index.getOtuRefsBySequenceIds(["seq_nope"])).rejects.toThrow(
			/seq_nope/,
		);
	});
});

describe("writeFasta", () => {
	it("writes byte-identical output to Python", async () => {
		const path = join(workPath, "reference.fa");

		await writeFasta(path, index.iterDefaultSequences());

		expect(await readFile(path, "utf8")).toBe(
			await readFile(join(FIXTURES, "default.fa"), "utf8"),
		);
	});

	it("writes nothing for an empty iterator", async () => {
		const path = join(workPath, "empty.fa");

		await writeFasta(path, index.iterOtuSequences([]));

		expect(await readFile(path, "utf8")).toBe("");
	});
});

describe("batching", () => {
	it("yields to the event loop while a scan runs", async () => {
		const path = join(workPath, "many.sqlite");
		const otus: IndexOtu[] = [];

		for (let otu = 0; otu < 3; otu++) {
			otus.push({
				abbreviation: "",
				id: `otu_${String(otu).padStart(3, "0")}`,
				isolates: [
					{
						default: true,
						id: "iso",
						sequences: Array.from({ length: 400 }, (_unused, sequence) => ({
							accession: `ACC${sequence}`,
							definition: "definition",
							host: null,
							id: `otu_${otu}_seq_${String(sequence).padStart(4, "0")}`,
							segment: null,
							sequence: "ACGT",
						})),
						source_name: "S",
						source_type: "isolate",
					},
				],
				name: `OTU ${otu}`,
				schema: [],
				taxid: null,
				version: 0,
			});
		}

		await createIndexArtifact(path, null, otus);

		const many = openWorkflowIndex({ id: 4, path });

		let ticks = 0;
		const ticker = setInterval(() => {
			ticks += 1;
		}, 0);

		const sequences: IndexSequence[] = await collect(many.iterSequences());

		clearInterval(ticker);
		many.close();

		expect(sequences).toHaveLength(1200);
		expect(ticks).toBeGreaterThan(0);
	});
});
