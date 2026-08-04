import { StorageKeyNotFoundError } from "../errors";
import type { StorageBackend, StorageObjectInfo } from "../types";

/** An async stream of the given chunks, as a backend's write() expects. */
export async function* stream(
	...chunks: Uint8Array[]
): AsyncIterable<Uint8Array> {
	for (const chunk of chunks) {
		yield chunk;
	}
}

/** A stream carrying `content` as a single UTF-8 chunk. */
export function streamOf(content: string): AsyncIterable<Uint8Array> {
	return stream(new TextEncoder().encode(content));
}

/** Drain a read() stream into a single buffer. */
export async function collect(
	data: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];

	for await (const chunk of data) {
		chunks.push(chunk);
	}

	// Backends yield Buffers, which compare unequal to a plain Uint8Array under
	// toEqual even with identical bytes. Normalize so assertions read on bytes.
	return new Uint8Array(Buffer.concat(chunks));
}

/** Drain a read() stream and decode it as UTF-8. */
export async function readText(
	storage: StorageBackend,
	key: string,
): Promise<string> {
	return new TextDecoder().decode(await collect(storage.read(key)));
}

/** Every object under `prefix`, in key order. */
export async function listAll(
	storage: StorageBackend,
	prefix: string,
): Promise<StorageObjectInfo[]> {
	const objects: StorageObjectInfo[] = [];

	for await (const object of storage.list(prefix)) {
		objects.push(object);
	}

	return objects.sort((a, b) => a.key.localeCompare(b.key));
}

/** An async iterable that rejects as soon as it is iterated. */
function rejecting(error: Error): AsyncIterable<never> {
	return {
		[Symbol.asyncIterator]() {
			return {
				next() {
					return Promise.reject(error);
				},
			};
		},
	};
}

/** A backend whose every method rejects, for exercising failure paths. */
export function failingStorage(
	overrides: Partial<StorageBackend> = {},
): StorageBackend {
	return {
		read(key: string) {
			return rejecting(new StorageKeyNotFoundError(key));
		},
		write() {
			return Promise.reject(new Error("write failed"));
		},
		delete() {
			return Promise.reject(new Error("delete failed"));
		},
		list() {
			return rejecting(new Error("list failed"));
		},
		size() {
			return Promise.reject(new Error("size failed"));
		},
		...overrides,
	};
}
