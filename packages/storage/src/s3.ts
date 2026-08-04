import { Readable } from "node:stream";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	paginateListObjectsV2,
	S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { StorageConfig } from "./config";
import { StorageError, StorageKeyNotFoundError } from "./errors";
import type { StorageBackend, StorageObjectInfo } from "./types";

type S3Config = Extract<StorageConfig, { kind: "s3" }>;

/**
 * S3 rejects a multipart upload whose parts are under 5 MiB, so this is a floor
 * rather than a preference — it is not the streaming chunk size.
 */
export const S3_MIN_PART_SIZE = 5 * 1024 * 1024;

function isNotFound(error: unknown): boolean {
	const { name, $metadata } = error as {
		name?: string;
		$metadata?: { httpStatusCode?: number };
	};

	// GetObject reports a missing key as NoSuchKey and HeadObject as NotFound,
	// since a HEAD has no body to carry the error code. S3-compatible backends
	// are not uniform about which they send, so the status code decides.
	return (
		name === "NoSuchKey" ||
		name === "NotFound" ||
		$metadata?.httpStatusCode === 404
	);
}

function rethrow(error: unknown, key: string): never {
	if (isNotFound(error)) {
		throw new StorageKeyNotFoundError(key);
	}

	throw new StorageError(
		error instanceof Error ? error.message : String(error),
	);
}

export function createS3Storage(config: S3Config): StorageBackend {
	const client = new S3Client({
		region: config.region,
		endpoint: config.endpoint,
		// A multipart object's stored checksum is a composite of its parts, which
		// real S3 marks with a `-N` suffix so the SDK knows not to check it against
		// the whole body. Garage returns it unsuffixed, so the SDK compares a
		// per-part checksum to the full object and every large read fails. Uploads
		// still send checksums; only the response-side comparison is dropped.
		responseChecksumValidation: "WHEN_REQUIRED",
		// Custom endpoints (MinIO, Garage) serve buckets as a path segment. Real
		// AWS is left on virtual-hosted addressing, which is what it expects.
		forcePathStyle: Boolean(config.endpoint),
		// Left undefined so the SDK's provider chain resolves an IAM role. Config
		// parsing guarantees these are set together or not at all.
		credentials:
			config.accessKeyId && config.secretAccessKey
				? {
						accessKeyId: config.accessKeyId,
						secretAccessKey: config.secretAccessKey,
					}
				: undefined,
	});

	const bucket = config.bucket;

	return {
		async *read(key: string): AsyncIterable<Uint8Array> {
			let body: unknown;

			try {
				const response = await client.send(
					new GetObjectCommand({ Bucket: bucket, Key: key }),
				);
				body = response.Body;
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

			async function* count(): AsyncIterable<Uint8Array> {
				for await (const chunk of data) {
					written += chunk.byteLength;
					yield chunk;
				}
			}

			try {
				await new Upload({
					client,
					params: { Bucket: bucket, Key: key, Body: Readable.from(count()) },
					partSize: S3_MIN_PART_SIZE,
				}).done();
			} catch (error) {
				throw new StorageError(
					error instanceof Error ? error.message : String(error),
				);
			}

			return written;
		},

		async delete(key: string): Promise<void> {
			try {
				await client.send(
					new DeleteObjectCommand({ Bucket: bucket, Key: key }),
				);
			} catch (error) {
				// S3 deletes are already idempotent, but Garage answers 404 for a key
				// it never had rather than the 204 the spec calls for.
				if (isNotFound(error)) {
					return;
				}

				throw new StorageError(
					error instanceof Error ? error.message : String(error),
				);
			}
		},

		async *list(prefix: string): AsyncIterable<StorageObjectInfo> {
			const pages = paginateListObjectsV2(
				{ client },
				{ Bucket: bucket, Prefix: prefix },
			);

			try {
				for await (const page of pages) {
					for (const object of page.Contents ?? []) {
						if (object.Key === undefined) {
							continue;
						}

						yield {
							key: object.Key,
							size: object.Size ?? 0,
							lastModified: object.LastModified ?? new Date(0),
						};
					}
				}
			} catch (error) {
				throw new StorageError(
					error instanceof Error ? error.message : String(error),
				);
			}
		},

		async size(key: string): Promise<number> {
			try {
				const response = await client.send(
					new HeadObjectCommand({ Bucket: bucket, Key: key }),
				);

				return response.ContentLength ?? 0;
			} catch (error) {
				rethrow(error, key);
			}
		},
	};
}
