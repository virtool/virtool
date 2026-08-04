import {
	BlobServiceClient,
	StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { GenericContainer, Wait } from "testcontainers";

const BUCKET = "virtool-test";
const ACCESS_KEY_ID = "GK000000000000000000000001";
const SECRET_ACCESS_KEY =
	"0000000000000000000000000000000000000000000000000000000000000001";
const REGION = "garage";
const ADMIN_TOKEN = "virtool-test-admin-token";

const AZURE_ACCOUNT = "devstoreaccount1";
const AZURE_CONTAINER = "virtool-test";

// The well-known Azurite development credentials, not a secret.
const AZURE_KEY =
	"Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

// Mirrors tests/garage.toml in the Python repo, with the RPC address pointed at
// loopback because a testcontainer has no stable hostname to advertise.
const GARAGE_CONFIG = `
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

replication_factor = 1

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "1111111111111111111111111111111111111111111111111111111111111111"

[s3_api]
s3_region = "${REGION}"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage"

[admin]
api_bind_addr = "[::]:3903"
admin_token = "${ADMIN_TOKEN}"
`;

async function callAdmin(
	adminUrl: string,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	return fetch(`${adminUrl}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${ADMIN_TOKEN}`,
			"Content-Type": "application/json",
			...init.headers,
		},
	});
}

async function waitForAdmin(adminUrl: string): Promise<void> {
	const deadline = Date.now() + 60_000;

	while (Date.now() < deadline) {
		try {
			const response = await callAdmin(adminUrl, "/health");

			if (response.ok) {
				return;
			}
		} catch {
			// Garage is still binding its admin listener.
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error("garage admin API never became healthy");
}

/**
 * Bring a fresh Garage node into service. A node with no layout accepts no S3
 * traffic at all, so the cluster layout has to be applied before the bucket and
 * key exist. Every step is idempotent, which is what lets the container be
 * reused across runs.
 */
async function bootstrapGarage(adminUrl: string): Promise<void> {
	await waitForAdmin(adminUrl);

	const { node } = await (await callAdmin(adminUrl, "/v1/status")).json();
	const { version } = await (await callAdmin(adminUrl, "/v1/layout")).json();

	if (version === 0) {
		await callAdmin(adminUrl, "/v1/layout", {
			method: "POST",
			body: JSON.stringify([
				{ id: node, zone: "dc1", capacity: 1_000_000_000, tags: [] },
			]),
		});
		await callAdmin(adminUrl, "/v1/layout/apply", {
			method: "POST",
			body: JSON.stringify({ version: 1 }),
		});
	}

	const existingBucket = await (
		await callAdmin(adminUrl, `/v1/bucket?globalAlias=${BUCKET}`)
	).json();

	const bucketId =
		existingBucket.id ??
		(
			await (
				await callAdmin(adminUrl, "/v1/bucket", {
					method: "POST",
					body: JSON.stringify({ globalAlias: BUCKET }),
				})
			).json()
		).id;

	const existingKey = await (
		await callAdmin(adminUrl, `/v1/key?id=${ACCESS_KEY_ID}`)
	).json();

	if (!existingKey.accessKeyId) {
		await callAdmin(adminUrl, "/v1/key/import", {
			method: "POST",
			body: JSON.stringify({
				accessKeyId: ACCESS_KEY_ID,
				secretAccessKey: SECRET_ACCESS_KEY,
				name: "virtool-test-key",
			}),
		});
	}

	await callAdmin(adminUrl, "/v1/bucket/allow", {
		method: "POST",
		body: JSON.stringify({
			bucketId,
			accessKeyId: ACCESS_KEY_ID,
			permissions: { read: true, write: true, owner: false },
		}),
	});
}

async function startGarage(): Promise<void> {
	const garage = await new GenericContainer("dxflrs/garage:v1.1.0")
		.withExposedPorts(3900, 3903)
		.withCopyContentToContainer([
			{ content: GARAGE_CONFIG, target: "/etc/garage.toml" },
		])
		// The default strategy confirms a port is bound by running a shell inside
		// the container. The Garage image is distroless, so that check can never
		// pass and the wait always times out. Watch the log instead.
		.withWaitStrategy(Wait.forLogMessage(/S3 API server listening/))
		.withReuse()
		.start();

	const host = garage.getHost();

	await bootstrapGarage(`http://${host}:${garage.getMappedPort(3903)}`);

	process.env.VT_TEST_S3_ENDPOINT = `http://${host}:${garage.getMappedPort(3900)}`;
	process.env.VT_TEST_S3_BUCKET = BUCKET;
	process.env.VT_TEST_S3_REGION = REGION;
	process.env.VT_TEST_S3_ACCESS_KEY_ID = ACCESS_KEY_ID;
	process.env.VT_TEST_S3_SECRET_ACCESS_KEY = SECRET_ACCESS_KEY;
}

async function startAzurite(): Promise<void> {
	const azurite = await new GenericContainer(
		"mcr.microsoft.com/azure-storage/azurite:3.33.0",
	)
		.withCommand([
			"azurite-blob",
			"--blobHost",
			"0.0.0.0",
			"--skipApiVersionCheck",
		])
		.withExposedPorts(10000)
		.withReuse()
		.start();

	const endpoint = `http://${azurite.getHost()}:${azurite.getMappedPort(10000)}/${AZURE_ACCOUNT}`;

	// Azurite starts with no containers, and the storage backend never creates
	// one — in production the container is provisioned outside the app.
	await new BlobServiceClient(
		endpoint,
		new StorageSharedKeyCredential(AZURE_ACCOUNT, AZURE_KEY),
	)
		.getContainerClient(AZURE_CONTAINER)
		.createIfNotExists();

	process.env.VT_TEST_AZURE_ENDPOINT = endpoint;
	process.env.VT_TEST_AZURE_ACCOUNT = AZURE_ACCOUNT;
	process.env.VT_TEST_AZURE_CONTAINER = AZURE_CONTAINER;
	process.env.VT_TEST_AZURE_KEY = AZURE_KEY;
}

export async function setup() {
	await Promise.all([startGarage(), startAzurite()]);
}

// There is deliberately no teardown, matching the postgres setup: stop() would
// remove the containers and defeat withReuse() on the next run.
