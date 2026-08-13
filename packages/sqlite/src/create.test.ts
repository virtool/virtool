import { chmod, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIndexArtifact } from "./create";
import { IndexOtuIntegrityError } from "./errors";
import golden from "./fixtures/golden.json" with { type: "json" };
import {
	type IndexOtu,
	type IndexReference,
	openWorkflowIndex,
	writeFasta,
} from "./queries";
import {
	INDEX_SQLITE_FILE_NAME,
	REFERENCE_SQLITE_FILE_NAME,
	REFERENCE_SQLITE_FORMAT,
	REFERENCE_SQLITE_FORMAT_VERSION,
} from "./schema";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const OTUS = golden.otus as IndexOtu[];

const REFERENCE = golden.referenceMetadata as IndexReference;

function takeOtu(): IndexOtu {
	const otu = OTUS[0];

	if (otu === undefined) {
		throw new Error("the fixture holds no OTUs");
	}

	return otu;
}

let workPath: string;

beforeEach(async () => {
	workPath = await mkdtemp(join(tmpdir(), "vt-index-create-"));
});

afterEach(async () => {
	await rm(workPath, { recursive: true, force: true });
});

describe("createIndexArtifact", () => {
	it("round-trips every query through a written artifact", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		await createIndexArtifact(path, REFERENCE, OTUS);

		const index = openWorkflowIndex({ id: 1, path });

		const [otus, sequences, defaultSequences, otuSequences] = await Promise.all(
			[
				collect(index.iterOtus()),
				collect(index.iterSequences()),
				collect(index.iterDefaultSequences()),
				collect(index.iterOtuSequences(golden.otuSequences.otuIds)),
			],
		);

		expect(await index.getReferenceMetadata()).toEqual(
			golden.referenceMetadata,
		);
		expect(otus).toEqual(golden.otus);
		expect(sequences).toEqual(golden.sequences);
		expect(defaultSequences).toEqual(golden.defaultSequences);
		expect(otuSequences).toEqual(golden.otuSequences.result);
		expect(
			await index.getOtuRefsBySequenceIds(
				golden.otuRefsBySequenceId.sequenceIds,
			),
		).toEqual(golden.otuRefsBySequenceId.result);

		index.close();
	});

	it("writes a FASTA byte-identical to Python's from a written artifact", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);
		const fastaPath = join(workPath, "reference.fa");

		await createIndexArtifact(path, REFERENCE, OTUS);

		const index = openWorkflowIndex({ id: 1, path });

		await writeFasta(fastaPath, index.iterDefaultSequences());

		index.close();

		expect(await readFile(fastaPath, "utf8")).toBe(
			await readFile(join(FIXTURES, "default.fa"), "utf8"),
		);
	});

	it("writes a schema matching the artifact Python built", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		await createIndexArtifact(path, REFERENCE, OTUS);

		expect(readSchema(path)).toEqual(
			readSchema(join(FIXTURES, REFERENCE_SQLITE_FILE_NAME)),
		);
	});

	it("stamps the format and version in the metadata table", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		await createIndexArtifact(path, REFERENCE, OTUS);

		const database = new DatabaseSync(path, { readOnly: true });
		const rows = database.prepare("SELECT key, value FROM metadata").all();

		database.close();

		expect(rows).toEqual([
			{ key: "format", value: REFERENCE_SQLITE_FORMAT },
			{ key: "format_version", value: REFERENCE_SQLITE_FORMAT_VERSION },
			{ key: "created_by", value: "virtool" },
		]);
	});

	it("records no reference id when there is no reference", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		await createIndexArtifact(path, null, OTUS);

		const database = new DatabaseSync(path, { readOnly: true });
		const rows = database.prepare("SELECT reference_id FROM otus").all();

		database.close();

		expect(rows.every((row) => row.reference_id === null)).toBe(true);
	});

	it("assigns isolates integer rowids, not their virtool ids", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		await createIndexArtifact(path, REFERENCE, OTUS);

		const database = new DatabaseSync(path, { readOnly: true });
		const rows = database
			.prepare("SELECT id, virtool_id FROM isolates ORDER BY id")
			.all();

		database.close();

		expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
		expect(rows.map((row) => row.virtool_id)).toEqual([
			"iso_b",
			"iso_a",
			"iso_m",
			"iso_z",
		]);
	});

	it("accepts an async iterable of OTUs", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		async function* stream() {
			for (const otu of OTUS) {
				yield otu;
			}
		}

		await createIndexArtifact(path, REFERENCE, stream());

		const index = openWorkflowIndex({ id: 1, path });

		expect(await collect(index.iterOtus())).toEqual(golden.otus);

		index.close();
	});

	it("replaces a file already at the path", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		await createIndexArtifact(path, REFERENCE, OTUS);
		await createIndexArtifact(path, REFERENCE, OTUS.slice(0, 1));

		const index = openWorkflowIndex({ id: 1, path });

		expect(await collect(index.iterOtus())).toHaveLength(1);

		index.close();
	});

	// Root ignores the directory mode this leans on, so there is no way to make
	// the unlink fail for it.
	it.skipIf(process.getuid?.() === 0)(
		"surfaces an unlink failure rather than swallowing it",
		async () => {
			const locked = join(workPath, "locked");

			await mkdir(locked);
			await createIndexArtifact(join(locked, INDEX_SQLITE_FILE_NAME), null, []);
			await chmod(locked, 0o500);

			try {
				await expect(
					createIndexArtifact(join(locked, INDEX_SQLITE_FILE_NAME), null, []),
				).rejects.toThrow(/EACCES|EPERM/);
			} finally {
				await chmod(locked, 0o700);
			}
		},
	);

	it("rolls back and leaves no partial artifact when a row is bad", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);

		const duplicated = [...OTUS.slice(0, 1), ...OTUS.slice(0, 1)];

		await expect(
			createIndexArtifact(path, REFERENCE, duplicated),
		).rejects.toThrow();

		const database = new DatabaseSync(path, { readOnly: true });
		const rows = database.prepare("SELECT id FROM otus").all();

		database.close();

		expect(rows).toEqual([]);
	});

	it("refuses an OTU with no isolates", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);
		const otu = takeOtu();

		await expect(
			createIndexArtifact(path, REFERENCE, [{ ...otu, isolates: [] }]),
		).rejects.toThrow(IndexOtuIntegrityError);
	});

	it("refuses an isolate with no sequences", async () => {
		const path = join(workPath, INDEX_SQLITE_FILE_NAME);
		const otu = takeOtu();
		const isolate = otu.isolates[0];

		if (isolate === undefined) {
			throw new Error("the fixture's first OTU has no isolates");
		}

		await expect(
			createIndexArtifact(path, REFERENCE, [
				{ ...otu, isolates: [{ ...isolate, sequences: [] }] },
			]),
		).rejects.toThrow(IndexOtuIntegrityError);
	});
});

function readSchema(path: string): string[] {
	const database = new DatabaseSync(path, { readOnly: true });

	const rows = database
		.prepare(
			`SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name`,
		)
		.all();

	database.close();

	return rows.map(
		(row) =>
			`${row.type} ${row.name} on ${row.tbl_name}: ${normalize(row.sql)}`,
	);
}

function normalize(sql: unknown): string {
	return sql === null ? "" : String(sql).replace(/\s+/g, " ").trim();
}

async function collect<T>(iterator: AsyncIterable<T>): Promise<T[]> {
	const items: T[] = [];

	for await (const item of iterator) {
		items.push(item);
	}

	return items;
}
