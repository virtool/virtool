import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { createTestWorkPath } from "@virtool/workflow/testing";
import { describe, expect, it, onTestFinished } from "vitest";
import { renameSequences, writeSubtractionFasta } from "./subtractionFasta";

async function rename(chunks: readonly string[]): Promise<string> {
	async function* source() {
		for (const chunk of chunks) {
			yield Buffer.from(chunk);
		}
	}

	const output: Buffer[] = [];

	for await (const chunk of renameSequences(source())) {
		output.push(chunk);
	}

	return Buffer.concat(output).toString();
}

describe("renameSequences", () => {
	it("renames each record to its ordinal", async () => {
		await expect(
			rename([">Prunus persica chr1\nACGT\nAC\n>Prunus persica chr2\nTTTT\n"]),
		).resolves.toBe(">1\nACGT\nAC\n>2\nTTTT\n");
	});

	// Every split point, so a header or a newline broken across chunks is
	// covered wherever it falls.
	it("renames records split across chunks", async () => {
		const fasta = ">Prunus a\nACGT\n>Prunus b\nTT\n>c\nG";

		for (let split = 0; split <= fasta.length; split++) {
			await expect(
				rename([fasta.slice(0, split), fasta.slice(split)]),
			).resolves.toBe(">1\nACGT\n>2\nTT\n>3\nG");
		}
	});

	it("renames records split into single bytes", async () => {
		await expect(rename([..."> a\nAC\n>b\nGT\n"])).resolves.toBe(
			">1\nAC\n>2\nGT\n",
		);
	});

	it("leaves a > inside a line alone", async () => {
		await expect(rename([">a\nAC>GT\n"])).resolves.toBe(">1\nAC>GT\n");
	});

	it("keeps a header's carriage return out of its new name", async () => {
		await expect(rename([">a b\r\nACGT\r\n"])).resolves.toBe(">1\nACGT\r\n");
	});
});

describe("writeSubtractionFasta", () => {
	it("writes the decompressed, renamed genome", async () => {
		const { path: workPath, cleanup } = await createTestWorkPath();
		onTestFinished(cleanup);

		const path = join(workPath, "subtractions", "1", "subtraction.fa");

		async function* source() {
			yield gzipSync(">Prunus persica chr1\nACGT\n>Prunus persica chr2\nTT\n");
		}

		await writeSubtractionFasta(source(), path);

		await expect(readFile(path, "utf8")).resolves.toBe(">1\nACGT\n>2\nTT\n");
	});
});
