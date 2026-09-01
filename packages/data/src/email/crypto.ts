import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const MASTER_KEY_BYTES = 32;

const NONCE_BYTES = 12;

const AUTH_TAG_BYTES = 16;

/** A parsed master key and its derived identifier. */
export type EmailMasterKey = {
	id: string;
	key: Buffer;
};

/** The parsed email master-key configuration. */
export type EmailMasterKeyConfig =
	| { status: "unset" }
	| { status: "invalid"; reason: string }
	| { status: "ok"; active: EmailMasterKey; previous: EmailMasterKey | null };

/** A versioned authenticated-encryption envelope for an email API key. */
export type EmailApiKeyEnvelope = {
	version: 1;
	algorithm: "aes-256-gcm";
	keyId: string;
	nonce: string;
	ciphertext: string;
	tag: string;
};

/** Why an envelope could not be decrypted. */
export type EmailDecryptFailure = "unknown_key" | "auth_failed" | "malformed";

/** The outcome of decrypting an envelope. */
export type EmailDecryptResult =
	| { ok: true; plaintext: string }
	| { ok: false; reason: EmailDecryptFailure };

function fingerprint(key: Buffer): string {
	return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function parseOneMasterKey(
	value: string,
): { ok: true; key: EmailMasterKey } | { ok: false; reason: string } {
	const decoded = Buffer.from(value, "base64");

	if (
		decoded.length !== MASTER_KEY_BYTES ||
		decoded.toString("base64") !== value
	) {
		return {
			ok: false,
			reason: `must be exactly ${MASTER_KEY_BYTES} bytes of standard base64`,
		};
	}

	return { ok: true, key: { id: fingerprint(decoded), key: decoded } };
}

/** Parse active and optional previous email master keys. */
export function parseEmailMasterKeys(
	active: string | undefined,
	previous: string | undefined,
): EmailMasterKeyConfig {
	if (!active) {
		if (previous) {
			return {
				status: "invalid",
				reason:
					"a previous master key is set without an active one; set the active key",
			};
		}

		return { status: "unset" };
	}

	const parsedActive = parseOneMasterKey(active);

	if (!parsedActive.ok) {
		return {
			status: "invalid",
			reason: `the active master key ${parsedActive.reason}`,
		};
	}

	if (!previous) {
		return { status: "ok", active: parsedActive.key, previous: null };
	}

	const parsedPrevious = parseOneMasterKey(previous);

	if (!parsedPrevious.ok) {
		return {
			status: "invalid",
			reason: `the previous master key ${parsedPrevious.reason}`,
		};
	}

	return {
		status: "ok",
		active: parsedActive.key,
		previous: parsedPrevious.key,
	};
}

/** Encrypt `plaintext` under `key`, producing a fresh-nonce envelope. */
export function encryptEmailApiKey(
	key: EmailMasterKey,
	plaintext: string,
): EmailApiKeyEnvelope {
	const nonce = randomBytes(NONCE_BYTES);
	const cipher = createCipheriv("aes-256-gcm", key.key, nonce);

	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);

	return {
		version: 1,
		algorithm: "aes-256-gcm",
		keyId: key.id,
		nonce: nonce.toString("base64"),
		ciphertext: ciphertext.toString("base64"),
		tag: cipher.getAuthTag().toString("base64"),
	};
}

/** Decrypt an API-key envelope with the master key named by its identifier. */
export function decryptEmailApiKey(
	keys: { active: EmailMasterKey; previous: EmailMasterKey | null },
	envelope: EmailApiKeyEnvelope,
): EmailDecryptResult {
	if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
		return { ok: false, reason: "malformed" };
	}

	const key =
		envelope.keyId === keys.active.id
			? keys.active
			: envelope.keyId === keys.previous?.id
				? keys.previous
				: null;

	if (key === null) {
		return { ok: false, reason: "unknown_key" };
	}

	const nonce = Buffer.from(envelope.nonce, "base64");
	const tag = Buffer.from(envelope.tag, "base64");

	if (nonce.length !== NONCE_BYTES || tag.length !== AUTH_TAG_BYTES) {
		return { ok: false, reason: "malformed" };
	}

	try {
		const decipher = createDecipheriv("aes-256-gcm", key.key, nonce);
		decipher.setAuthTag(tag);

		const plaintext = Buffer.concat([
			decipher.update(Buffer.from(envelope.ciphertext, "base64")),
			decipher.final(),
		]);

		return { ok: true, plaintext: plaintext.toString("utf8") };
	} catch {
		return { ok: false, reason: "auth_failed" };
	}
}
