import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { type OtuChunk, streamArtifact } from "./artifact";

async function collect(
	iterable: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> {
	const parts: Uint8Array[] = [];

	for await (const part of iterable) {
		parts.push(part);
	}

	return Buffer.concat(parts);
}

async function* chunksOf(...chunks: OtuChunk[]): AsyncIterable<OtuChunk> {
	for (const chunk of chunks) {
		yield chunk;
	}
}

const reference = {
	_id: 7,
	created_at: "2026-01-02T03:04:05.123456Z",
	name: "Plant Viruses",
	organism: "virus",
};

async function build(...chunks: OtuChunk[]): Promise<string> {
	return gunzipSync(
		await collect(streamArtifact(reference, chunksOf(...chunks))),
	).toString();
}

describe("streamArtifact", () => {
	it("writes the envelope Python writes, with the OTUs last", async () => {
		const text = await build([{ _id: "otu1" }], [{ _id: "otu2" }]);

		// The field order is asserted on the text rather than the parsed object,
		// because it is the bytes workflows read and a parse would hide a reorder.
		expect(text).toBe(
			'{"_id":7,"created_at":"2026-01-02T03:04:05.123456Z","data_type":"genome",' +
				'"name":"Plant Viruses","organism":"virus",' +
				'"otus":[{"_id":"otu1"},{"_id":"otu2"}]}',
		);
	});

	// Python hard-codes it rather than reading the reference row, and workflows
	// consume the field, so it is a wire value and not a fact about the row.
	it("hard-codes data_type to genome", async () => {
		expect(JSON.parse(await build([]))).toMatchObject({ data_type: "genome" });
	});

	it("writes a valid empty otus array when the manifest is empty", async () => {
		expect(JSON.parse(await build())).toEqual({
			_id: 7,
			created_at: "2026-01-02T03:04:05.123456Z",
			data_type: "genome",
			name: "Plant Viruses",
			organism: "virus",
			otus: [],
		});
	});

	it("keeps OTUs in the order the chunks yield them", async () => {
		const text = await build(
			[{ _id: "c" }, { _id: "a" }],
			[{ _id: "b" }],
			[{ _id: "z" }, { _id: "y" }],
		);

		expect(
			(JSON.parse(text) as { otus: { _id: string }[] }).otus.map(
				(otu) => otu._id,
			),
		).toEqual(["c", "a", "b", "z", "y"]);
	});

	// The chunk source is pulled as the gzip stream takes bytes, so a source that
	// throws part-way surfaces on the write rather than being swallowed into a
	// truncated artifact.
	it("propagates a failure from the chunk source", async () => {
		async function* failing(): AsyncIterable<OtuChunk> {
			yield [{ _id: "otu1" }];
			throw new Error("history is corrupt");
		}

		await expect(collect(streamArtifact(reference, failing()))).rejects.toThrow(
			"history is corrupt",
		);
	});
});
