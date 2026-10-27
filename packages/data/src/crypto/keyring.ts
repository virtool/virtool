import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import type { Logger } from "@virtool/logger";

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

type Key = {
	id: string;
	value: Buffer;
};

/** A versioned authenticated-encryption envelope for a stored secret. */
export type EncryptedValue = {
	version: 1;
	algorithm: "aes-256-gcm";
	purpose: string;
	keyId: string;
	nonce: string;
	ciphertext: string;
	tag: string;
};

/** Why a keyring operation could not be completed. */
export type KeyringFailure =
	| "unavailable"
	| "unknown_key"
	| "wrong_purpose"
	| "auth_failed"
	| "malformed";

/** The outcome of encrypting a stored secret. */
export type EncryptResult =
	| { ok: true; value: EncryptedValue }
	| { ok: false; reason: "unavailable" };

/** The outcome of decrypting a stored secret. */
export type DecryptResult =
	| { ok: true; plaintext: string }
	| { ok: false; reason: KeyringFailure };

/** The status of the process encryption keyring. */
export type KeyringStatus =
	| { state: "ready" }
	| { state: "unset" }
	| { state: "invalid"; reason: string };

/**
 * Report the keyring status at startup.
 *
 * An unset or invalid key does not stop a service, so without this line the
 * first sign of a bad key is a much later message about a secret that cannot
 * be decrypted, which points at the stored value rather than at the key.
 */
export function logKeyringStatus(status: KeyringStatus, logger: Logger): void {
	if (status.state === "ready") {
		logger.info({ state: status.state }, "encryption keyring ready");

		return;
	}

	if (status.state === "unset") {
		logger.warn(
			{ state: status.state },
			"no encryption key configured: stored secrets are unavailable",
		);

		return;
	}

	logger.error(
		{ reason: status.reason, state: status.state },
		"encryption key is invalid: stored secrets are unavailable",
	);
}

/** A process-wide service for purpose-bound encryption of stored secrets. */
export type Keyring = {
	status: KeyringStatus;
	encrypt(purpose: string, plaintext: string): EncryptResult;
	decrypt(purpose: string, value: EncryptedValue): DecryptResult;
	isCurrent(value: EncryptedValue): boolean;
};

function fingerprint(value: Buffer): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function parseKey(
	value: string,
): { ok: true; key: Key } | { ok: false; reason: string } {
	const decoded = Buffer.from(value, "base64");

	if (decoded.length !== KEY_BYTES || decoded.toString("base64") !== value) {
		return {
			ok: false,
			reason: `must be exactly ${KEY_BYTES} bytes of standard base64`,
		};
	}

	return { ok: true, key: { id: fingerprint(decoded), value: decoded } };
}

function createUnavailableKeyring(status: KeyringStatus): Keyring {
	return {
		status,
		encrypt() {
			return { ok: false, reason: "unavailable" };
		},
		decrypt() {
			return { ok: false, reason: "unavailable" };
		},
		isCurrent() {
			return false;
		},
	};
}

function createReadyKeyring(active: Key, previous: Key | null): Keyring {
	return {
		status: { state: "ready" },
		encrypt(purpose, plaintext) {
			const nonce = randomBytes(NONCE_BYTES);
			const cipher = createCipheriv("aes-256-gcm", active.value, nonce);
			cipher.setAAD(Buffer.from(purpose, "utf8"));
			const ciphertext = Buffer.concat([
				cipher.update(plaintext, "utf8"),
				cipher.final(),
			]);

			return {
				ok: true,
				value: {
					version: 1,
					algorithm: "aes-256-gcm",
					purpose,
					keyId: active.id,
					nonce: nonce.toString("base64"),
					ciphertext: ciphertext.toString("base64"),
					tag: cipher.getAuthTag().toString("base64"),
				},
			};
		},
		decrypt(purpose, value) {
			if (value.version !== 1 || value.algorithm !== "aes-256-gcm") {
				return { ok: false, reason: "malformed" };
			}

			if (value.purpose !== purpose) {
				return { ok: false, reason: "wrong_purpose" };
			}

			const key =
				value.keyId === active.id
					? active
					: value.keyId === previous?.id
						? previous
						: null;

			if (key === null) {
				return { ok: false, reason: "unknown_key" };
			}

			const nonce = Buffer.from(value.nonce, "base64");
			const tag = Buffer.from(value.tag, "base64");

			if (nonce.length !== NONCE_BYTES || tag.length !== AUTH_TAG_BYTES) {
				return { ok: false, reason: "malformed" };
			}

			try {
				const decipher = createDecipheriv("aes-256-gcm", key.value, nonce);
				decipher.setAAD(Buffer.from(purpose, "utf8"));
				decipher.setAuthTag(tag);
				const plaintext = Buffer.concat([
					decipher.update(Buffer.from(value.ciphertext, "base64")),
					decipher.final(),
				]);

				return { ok: true, plaintext: plaintext.toString("utf8") };
			} catch {
				return { ok: false, reason: "auth_failed" };
			}
		},
		isCurrent(value) {
			return value.keyId === active.id;
		},
	};
}

/** Create a keyring from active and optional previous standard-base64 keys. */
export function createKeyring(
	active: string | undefined,
	previous: string | undefined,
): Keyring {
	if (!active) {
		if (previous) {
			return createUnavailableKeyring({
				state: "invalid",
				reason:
					"a previous encryption key is set without an active one; set the active key",
			});
		}

		return createUnavailableKeyring({ state: "unset" });
	}

	const parsedActive = parseKey(active);

	if (!parsedActive.ok) {
		return createUnavailableKeyring({
			state: "invalid",
			reason: `the active encryption key ${parsedActive.reason}`,
		});
	}

	if (!previous) {
		return createReadyKeyring(parsedActive.key, null);
	}

	const parsedPrevious = parseKey(previous);

	if (!parsedPrevious.ok) {
		return createUnavailableKeyring({
			state: "invalid",
			reason: `the previous encryption key ${parsedPrevious.reason}`,
		});
	}

	return createReadyKeyring(parsedActive.key, parsedPrevious.key);
}
