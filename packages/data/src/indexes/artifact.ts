// The `reference-v2.json.gz` artifact a finished build publishes, encoded as a
// stream.
//
// A real reference decompresses to hundreds of megabytes of JSON. Python builds
// the whole document in memory and gzips it in one call, which costs two
// allocations of that size; nothing here holds more than one chunk of OTUs at a
// time, so peak memory is set by the chunk size rather than by the reference.
//
// The field order is Python's — the reference envelope, then `otus` — because
// the artifact is read by workflows that both services still run.

import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

/** The reference envelope an artifact opens with. */
export type ArtifactReference = {
	/** The integer Postgres primary key, despite the Mongo-shaped field name. */
	_id: number;
	/** Pre-rendered to match Python's serializer exactly. */
	created_at: string;
	name: string;
	organism: string;
};

/** One page of OTU documents, in the order the manifest names them. */
export type OtuChunk = readonly unknown[];

/**
 * Encode the artifact as UTF-8 JSON, one chunk of OTUs at a time.
 *
 * `data_type` is hard-coded to `"genome"` rather than read from the reference,
 * matching Python. Workflows consume the field, so it is a wire value here and
 * not a fact about the row.
 */
async function* encode(
	reference: ArtifactReference,
	chunks: AsyncIterable<OtuChunk>,
): AsyncIterable<Uint8Array> {
	const encoder = new TextEncoder();

	const envelope = JSON.stringify({
		_id: reference._id,
		created_at: reference.created_at,
		data_type: "genome",
		name: reference.name,
		organism: reference.organism,
	});

	// Reopen the object rather than serializing `otus` into it, so the OTUs are
	// never a value the envelope has to hold.
	yield encoder.encode(`${envelope.slice(0, -1)},"otus":[`);

	let first = true;

	for await (const chunk of chunks) {
		for (const otu of chunk) {
			yield encoder.encode(
				first ? JSON.stringify(otu) : `,${JSON.stringify(otu)}`,
			);
			first = false;
		}
	}

	yield encoder.encode("]}");
}

/**
 * Gzip the artifact into the async iterable `StorageBackend.write` consumes.
 *
 * The gzip stream is what applies backpressure: the encoder is pulled only as
 * fast as the compressor and the upload behind it take bytes, so a slow bucket
 * cannot make the OTU chunks queue up in memory.
 *
 * The error forwarding is load-bearing and must not be dropped. `pipe` does not
 * propagate a source failure to its destination, so a chunk source that throws
 * part-way — the manifest naming a version history cannot produce — would end
 * the gzip stream cleanly. The caller would store a truncated artifact, record
 * its size and mark the build ready, having been told nothing went wrong.
 */
export function streamArtifact(
	reference: ArtifactReference,
	chunks: AsyncIterable<OtuChunk>,
): AsyncIterable<Uint8Array> {
	const source = Readable.from(encode(reference, chunks));
	const gzip = createGzip();

	source.on("error", (err) => gzip.destroy(err));

	return source.pipe(gzip);
}
