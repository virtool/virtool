import { Readable } from "node:stream";
import { DefaultAzureCredential } from "@azure/identity";
import {
	BlobSASPermissions,
	BlobServiceClient,
	type ContainerClient,
	generateBlobSASQueryParameters,
	SASProtocol,
	StorageSharedKeyCredential,
	type UserDelegationKey,
} from "@azure/storage-blob";
import type { StorageConfig } from "./config";
import { StorageError, StorageKeyNotFoundError } from "./errors";
import type {
	PresignDownloadOptions,
	StorageBackend,
	StorageObjectInfo,
} from "./types";
import { STORAGE_CHUNK_SIZE } from "./types";

type AzureConfig = Extract<StorageConfig, { kind: "azure" }>;

const UPLOAD_CONCURRENCY = 4;

// A user-delegation key is an account-level round trip valid for up to seven
// days, so one is requested for that long and reused. It is refreshed once it
// falls inside the margin rather than on the tick it expires, so a download
// never waits on a key that lapsed a second ago.
const DELEGATION_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DELEGATION_KEY_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

// The signature is backdated a little so a presigned URL works despite modest
// clock skew between this process and the storage service.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

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

function createServiceClient(config: AzureConfig): {
	service: BlobServiceClient;
	sharedKey: StorageSharedKeyCredential | null;
} {
	const url =
		config.endpoint ?? `https://${config.account}.blob.core.windows.net`;

	// Without an access key the deployment is expected to carry a managed
	// identity, which the default credential chain resolves.
	if (!config.accessKey) {
		return {
			service: new BlobServiceClient(url, new DefaultAzureCredential()),
			sharedKey: null,
		};
	}

	const sharedKey = new StorageSharedKeyCredential(
		config.account,
		config.accessKey,
	);

	return { service: new BlobServiceClient(url, sharedKey), sharedKey };
}

// Only swap the origin so the signed resource path remains unchanged.
function buildDownloadUrl(
	container: ContainerClient,
	key: string,
	config: AzureConfig,
	sas: string,
): string {
	const url = new URL(container.getBlobClient(key).url);

	if (config.downloadUrl) {
		const origin = new URL(config.downloadUrl);
		url.protocol = origin.protocol;
		url.host = origin.host;
	}

	return `${url.toString()}?${sas}`;
}

function createPresign(
	config: AzureConfig,
	service: BlobServiceClient,
	container: ContainerClient,
	sharedKey: StorageSharedKeyCredential | null,
): StorageBackend["presignDownload"] {
	let cached: { key: UserDelegationKey; expiresOn: Date } | null = null;
	let inflight: Promise<UserDelegationKey> | null = null;

	async function getDelegationKey(): Promise<UserDelegationKey> {
		const now = new Date();

		if (
			cached &&
			cached.expiresOn.getTime() - now.getTime() >
				DELEGATION_KEY_REFRESH_MARGIN_MS
		) {
			return cached.key;
		}

		if (!inflight) {
			const startsOn = new Date(now.getTime() - CLOCK_SKEW_MS);
			// Azure caps a user-delegation key at seven days from its start, so the
			// expiry is measured from `startsOn` rather than now — the backdated skew
			// would otherwise push the span past the limit and the request rejects.
			const expiresOn = new Date(startsOn.getTime() + DELEGATION_KEY_TTL_MS);

			inflight = service
				.getUserDelegationKey(startsOn, expiresOn)
				.then((key) => {
					cached = { key, expiresOn };
					return key;
				})
				.finally(() => {
					inflight = null;
				});
		}

		return inflight;
	}

	return async function presignDownload(
		key: string,
		options: PresignDownloadOptions,
	): Promise<string> {
		const now = new Date();
		const startsOn = new Date(now.getTime() - CLOCK_SKEW_MS);
		const expiresOn = new Date(now.getTime() + options.expiresIn * 1000);

		const values = {
			containerName: config.container,
			blobName: key,
			permissions: BlobSASPermissions.parse("r"),
			startsOn,
			expiresOn,
			contentDisposition: options.contentDisposition,
			contentType: options.contentType,
			// Real Azure is https-only; a plain-http endpoint or download host —
			// Azurite in development — has to keep http allowed or the SAS refuses it.
			protocol:
				config.endpoint?.startsWith("http://") ||
				config.downloadUrl?.startsWith("http://")
					? SASProtocol.HttpsAndHttp
					: SASProtocol.Https,
		};

		try {
			// A shared key — Azurite in development — cannot mint a user-delegation
			// SAS, so it signs the SAS directly. A managed identity has no signing
			// key of its own and must go through the delegation key.
			const sas = sharedKey
				? generateBlobSASQueryParameters(values, sharedKey).toString()
				: generateBlobSASQueryParameters(
						values,
						await getDelegationKey(),
						config.account,
					).toString();

			return buildDownloadUrl(container, key, config, sas);
		} catch (error) {
			throw new StorageError(
				error instanceof Error ? error.message : String(error),
			);
		}
	};
}

export function createAzureStorage(config: AzureConfig): StorageBackend {
	const { service, sharedKey } = createServiceClient(config);
	const container = service.getContainerClient(config.container);

	return {
		presignDownload: createPresign(config, service, container, sharedKey),

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
