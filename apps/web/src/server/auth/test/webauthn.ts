import {
	createHash,
	generateKeyPairSync,
	randomBytes,
	sign,
} from "node:crypto";
import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";

const USER_PRESENT = 0x01;
const USER_VERIFIED = 0x04;
const BACKUP_ELIGIBLE = 0x08;
const BACKED_UP = 0x10;
const ATTESTED_CREDENTIAL = 0x40;

/** Options a test can change on one simulated ceremony. */
type CeremonyOptions = {
	/** The origin the browser reports in `clientDataJSON`. */
	origin?: string;
	/** The RP ID the authenticator scopes the credential to. */
	rpId?: string;
	/** Whether the authenticator reports that it verified the user. */
	userVerified?: boolean;
};

function sha256(data: Uint8Array | string): Buffer {
	return createHash("sha256").update(data).digest();
}

function toBase64Url(bytes: Uint8Array): string {
	return isoBase64URL.fromBuffer(new Uint8Array(bytes));
}

/**
 * A synced, ES256 software passkey that answers WebAuthn ceremonies the way a
 * browser would, so tests can drive the real verification path.
 */
export function createSoftwareAuthenticator(defaults: {
	origin: string;
	rpId: string;
	credentialId?: Uint8Array;
}) {
	const { privateKey, publicKey } = generateKeyPairSync("ec", {
		namedCurve: "P-256",
	});
	const jwk = publicKey.export({ format: "jwk" });
	const credentialId = defaults.credentialId ?? randomBytes(32);
	const cosePublicKey = isoCBOR.encode(
		new Map<number, number | Uint8Array>([
			[1, 2],
			[3, -7],
			[-1, 1],
			[-2, Buffer.from(jwk.x ?? "", "base64url")],
			[-3, Buffer.from(jwk.y ?? "", "base64url")],
		]),
	);

	function authenticatorData(
		rpId: string,
		userVerified: boolean,
		attested: boolean,
	): Buffer {
		const flags =
			USER_PRESENT |
			(userVerified ? USER_VERIFIED : 0) |
			BACKUP_ELIGIBLE |
			BACKED_UP |
			(attested ? ATTESTED_CREDENTIAL : 0);
		const parts = [sha256(rpId), Buffer.from([flags]), Buffer.alloc(4)];
		if (attested) {
			const length = Buffer.alloc(2);
			length.writeUInt16BE(credentialId.length);
			parts.push(
				Buffer.alloc(16),
				length,
				Buffer.from(credentialId),
				Buffer.from(cosePublicKey),
			);
		}
		return Buffer.concat(parts);
	}

	function clientData(type: string, challenge: string, origin: string) {
		return Buffer.from(
			JSON.stringify({ type, challenge, origin, crossOrigin: false }),
		);
	}

	return {
		credentialId: toBase64Url(credentialId),

		/** Answer `navigator.credentials.create()` for `options`. */
		register(
			options: { challenge: string },
			{
				origin = defaults.origin,
				rpId = defaults.rpId,
				userVerified = true,
			}: CeremonyOptions = {},
		) {
			const attestationObject = isoCBOR.encode(
				new Map<string, Parameters<typeof isoCBOR.encode>[0]>([
					["fmt", "none"],
					["attStmt", new Map()],
					["authData", authenticatorData(rpId, userVerified, true)],
				]),
			);

			return {
				id: toBase64Url(credentialId),
				rawId: toBase64Url(credentialId),
				type: "public-key" as const,
				response: {
					clientDataJSON: toBase64Url(
						clientData("webauthn.create", options.challenge, origin),
					),
					attestationObject: toBase64Url(attestationObject),
					transports: ["internal" as const, "hybrid" as const],
				},
				clientExtensionResults: {},
			};
		},

		/** Answer `navigator.credentials.get()` for `options`. */
		authenticate(
			options: { challenge: string },
			{
				origin = defaults.origin,
				rpId = defaults.rpId,
				userVerified = true,
			}: CeremonyOptions = {},
		) {
			const data = authenticatorData(rpId, userVerified, false);
			const client = clientData("webauthn.get", options.challenge, origin);
			const signature = sign(
				"sha256",
				Buffer.concat([data, sha256(client)]),
				privateKey,
			);

			return {
				id: toBase64Url(credentialId),
				rawId: toBase64Url(credentialId),
				type: "public-key" as const,
				response: {
					clientDataJSON: toBase64Url(client),
					authenticatorData: toBase64Url(data),
					signature: toBase64Url(signature),
				},
				clientExtensionResults: {},
			};
		},
	};
}
