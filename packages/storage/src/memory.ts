import { StorageKeyNotFoundError } from "./errors";
import type { StorageBackend, StorageObjectInfo } from "./types";

type StoredObject = {
	body: Uint8Array;
	lastModified: Date;
};

async function collect(data: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let size = 0;

	for await (const chunk of data) {
		chunks.push(chunk);
		size += chunk.byteLength;
	}

	const body = new Uint8Array(size);
	let offset = 0;

	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return body;
}

/**
 * In-memory storage for unit tests. Consumers take a StorageBackend argument,
 * so anything that stores files can be tested against this without a bucket.
 */
export class MemoryStorage implements StorageBackend {
	private readonly objects = new Map<string, StoredObject>();

	async *read(key: string): AsyncIterable<Uint8Array> {
		const object = this.objects.get(key);

		if (!object) {
			throw new StorageKeyNotFoundError(key);
		}

		yield object.body;
	}

	async write(key: string, data: AsyncIterable<Uint8Array>): Promise<number> {
		const body = await collect(data);

		this.objects.set(key, { body, lastModified: new Date() });

		return body.byteLength;
	}

	async delete(key: string): Promise<void> {
		this.objects.delete(key);
	}

	async *list(prefix: string): AsyncIterable<StorageObjectInfo> {
		for (const [key, object] of [...this.objects.entries()].sort(([a], [b]) =>
			a.localeCompare(b),
		)) {
			if (key.startsWith(prefix)) {
				yield {
					key,
					size: object.body.byteLength,
					lastModified: object.lastModified,
				};
			}
		}
	}

	async size(key: string): Promise<number> {
		const object = this.objects.get(key);

		if (!object) {
			throw new StorageKeyNotFoundError(key);
		}

		return object.body.byteLength;
	}
}
