import { Readable } from "node:stream";
import { DefaultAzureCredential } from "@azure/identity";
import {
	BlobServiceClient,
	StorageSharedKeyCredential,
} from "@azure/storage-blob";
import type { StorageConfig } from "./config";
import { StorageError, StorageKeyNotFoundError } from "./errors";
import type { StorageBackend, StorageObjectInfo } from "./types";
import { STORAGE_CHUNK_SIZE } from "./types";

type AzureConfig = Extract<StorageConfig, { kind: "azure" }>;

const UPLOAD_CONCURRENCY = 4;

function isNotFound(error: unknown): boolean {
	const { statusCode, code } = error as { statusCode?: number; code?: string };

	return statusCode === 404 || code === "BlobNotFound";
}

function rethrow(error: unknown, key: string): never {
	if (isNotFound(error)) {
		throw new StorageKeyNotFoundError(key);
	}

	throw new StorageError(
		error instanceof Error ? error.message : String(error),
	);
}

function createServiceClient(config: AzureConfig): BlobServiceClient {
	const url =
		config.endpoint ?? `https://${config.account}.blob.core.windows.net`;

	// Without an access key the deployment is expected to carry a managed
	// identity, which the default credential chain resolves.
	if (!config.accessKey) {
		return new BlobServiceClient(url, new DefaultAzureCredential());
	}

	return new BlobServiceClient(
		url,
		new StorageSharedKeyCredential(config.account, config.accessKey),
	);
}

export function createAzureStorage(config: AzureConfig): StorageBackend {
	const container = createServiceClient(config).getContainerClient(
		config.container,
	);

	return {
		async *read(key: string): AsyncIterable<Uint8Array> {
			let body: NodeJS.ReadableStream | undefined;

			try {
				body = (await container.getBlobClient(key).download())
					.readableStreamBody;
			} catch (error) {
				rethrow(error, key);
			}

			if (!body) {
				throw new StorageKeyNotFoundError(key);
			}

			yield* body as AsyncIterable<Uint8Array>;
		},

		async write(key: string, data: AsyncIterable<Uint8Array>): Promise<number> {
			let written = 0;

			// The Azure SDK pools incoming chunks with Buffer.copy, so a plain
			// Uint8Array reaches it as an object with no copy method and the upload
			// dies. Wrap each chunk as a Buffer view — no copy, same bytes.
			async function* count(): AsyncIterable<Buffer> {
				for await (const chunk of data) {
					written += chunk.byteLength;
					yield Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
				}
			}

			try {
				await container
					.getBlockBlobClient(key)
					.uploadStream(
						Readable.from(count()),
						STORAGE_CHUNK_SIZE,
						UPLOAD_CONCURRENCY,
					);
			} catch (error) {
				throw new StorageError(
					error instanceof Error ? error.message : String(error),
				);
			}

			return written;
		},

		async delete(key: string): Promise<void> {
			try {
				await container.getBlobClient(key).deleteIfExists();
			} catch (error) {
				if (isNotFound(error)) {
					return;
				}

				throw new StorageError(
					error instanceof Error ? error.message : String(error),
				);
			}
		},

		async *list(prefix: string): AsyncIterable<StorageObjectInfo> {
			try {
				for await (const blob of container.listBlobsFlat({ prefix })) {
					yield {
						key: blob.name,
						size: blob.properties.contentLength ?? 0,
						lastModified: blob.properties.lastModified ?? new Date(0),
					};
				}
			} catch (error) {
				throw new StorageError(
					error instanceof Error ? error.message : String(error),
				);
			}
		},

		async size(key: string): Promise<number> {
			try {
				const properties = await container.getBlobClient(key).getProperties();

				return properties.contentLength ?? 0;
			} catch (error) {
				rethrow(error, key);
			}
		},
	};
}
