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
	PresignUploadOptions,
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

// Only swap the origin so the signed resource path remains unchanged. A SAS
// signs the container and blob names, not the host, so redirecting the request
// through a different origin — Front Door — leaves the signature valid.
function buildPresignedUrl(
	container: ContainerClient,
	key: string,
	sas: string,
	origin: string | undefined,
): string {
	const url = new URL(container.getBlobClient(key).url);

	if (origin) {
		const override = new URL(origin);
		url.protocol = override.protocol;
		url.host = override.host;
	}

	return `${url.toString()}?${sas}`;
}

// Real Azure is https-only; a plain-http endpoint or public origin — Azurite in
// development — has to keep http allowed or the SAS refuses it.
function sasProtocol(...origins: (string | undefined)[]): SASProtocol {
	return origins.some((origin) => origin?.startsWith("http://"))
		? SASProtocol.HttpsAndHttp
		: SASProtocol.Https;
}

/**
 * A cached provider of the account's user-delegation key.
 *
 * A managed identity has no signing key of its own, so both presigned downloads
 * and presigned uploads sign through this one delegation key rather than each
 * requesting its own.
 */
function createDelegationKeyProvider(
	service: BlobServiceClient,
): () => Promise<UserDelegationKey> {
	let cached: { key: UserDelegationKey; expiresOn: Date } | null = null;
	let inflight: Promise<UserDelegationKey> | null = null;

	return async function getDelegationKey(): Promise<UserDelegationKey> {
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
	};
}

function createPresignDownload(
	config: AzureConfig,
	container: ContainerClient,
	sharedKey: StorageSharedKeyCredential | null,
	getDelegationKey: () => Promise<UserDelegationKey>,
): NonNullable<StorageBackend["presignDownload"]> {
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
			protocol: sasProtocol(config.endpoint, config.downloadUrl),
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

			return buildPresignedUrl(container, key, sas, config.downloadUrl);
		} catch (error) {
			throw new StorageError(
				error instanceof Error ? error.message : String(error),
			);
		}
	};
}

function createPresignUpload(
	config: AzureConfig,
	container: ContainerClient,
	sharedKey: StorageSharedKeyCredential | null,
	getDelegationKey: () => Promise<UserDelegationKey>,
): NonNullable<StorageBackend["presignUpload"]> {
	// Front Door is the only route to the private storage account, so an upload
	// URL prefers the Front Door origin, then the download origin, then the raw
	// blob endpoint for a development backend reachable directly.
	const origin = config.uploadUrl ?? config.downloadUrl;

	return async function presignUpload(
		key: string,
		options: PresignUploadOptions,
	): Promise<string> {
		const now = new Date();
		const startsOn = new Date(now.getTime() - CLOCK_SKEW_MS);
		const expiresOn = new Date(now.getTime() + options.expiresIn * 1000);

		const values = {
			containerName: config.container,
			blobName: key,
			// Create and write cover staging blocks and committing the block list.
			permissions: BlobSASPermissions.parse("cw"),
			startsOn,
			expiresOn,
			protocol: sasProtocol(config.endpoint, origin),
		};

		try {
			const sas = sharedKey
				? generateBlobSASQueryParameters(values, sharedKey).toString()
				: generateBlobSASQueryParameters(
						values,
						await getDelegationKey(),
						config.account,
					).toString();

			return buildPresignedUrl(container, key, sas, origin);
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
	const getDelegationKey = createDelegationKeyProvider(service);

	return {
		presignDownload: createPresignDownload(
			config,
			container,
			sharedKey,
			getDelegationKey,
		),

		presignUpload: createPresignUpload(
			config,
			container,
			sharedKey,
			getDelegationKey,
		),

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
