import type { NcbiAvailability } from "@virtool/contracts";
import type { EncryptedValue, Keyring } from "../crypto/keyring";
import type { Db } from "../db/pg";
import { AppError } from "../errors";
import { getSettings, type Settings, updateSettings } from "./data";

const NCBI_API_KEY_PURPOSE = "ncbi_api_key";

/** Thrown when the stored NCBI API key cannot be written or re-encrypted. */
export class NcbiConfigurationError extends AppError {}

/** The stored NCBI API key resolved against the process keyring. */
export type NcbiApiKeyState = {
	availability: NcbiAvailability;
	apiKey: string | null;
};

/**
 * Resolve the stored envelope against the process keyring.
 *
 * Every failure — an unset or invalid keyring, an envelope written under a key
 * this process does not hold, a wrong purpose, a malformed envelope, a failed
 * authentication tag — collapses to `configuration_error`. The distinction
 * matters to an operator, not to a caller, and reporting it would tell a
 * client something about the stored value. Nothing here writes, so a stored
 * key survives a bad encryption key untouched.
 */
export function resolveNcbiApiKey(
	envelope: EncryptedValue | null,
	keyring: Keyring,
): NcbiApiKeyState {
	if (envelope === null) {
		return { availability: "unconfigured", apiKey: null };
	}

	if (keyring.status.state !== "ready") {
		return { availability: "configuration_error", apiKey: null };
	}

	const decrypted = keyring.decrypt(NCBI_API_KEY_PURPOSE, envelope);

	if (!decrypted.ok) {
		return { availability: "configuration_error", apiKey: null };
	}

	return { availability: "ready", apiKey: decrypted.plaintext };
}

/** Encrypt and store an NCBI API key under the active encryption key. */
export async function setNcbiApiKey(
	db: Db,
	keyring: Keyring,
	apiKey: string,
): Promise<Settings> {
	const encrypted = keyring.encrypt(NCBI_API_KEY_PURPOSE, apiKey);

	if (!encrypted.ok) {
		throw new NcbiConfigurationError(
			"an encryption key must be configured before an API key can be stored",
		);
	}

	return updateSettings(db, { ncbiApiKey: encrypted.value });
}

/** Clear the stored NCBI API key. */
export async function clearNcbiApiKey(db: Db): Promise<Settings> {
	return updateSettings(db, { ncbiApiKey: null });
}

/**
 * Re-encrypt the stored NCBI API key under the active encryption key.
 *
 * The read-old/write-new half of a key rotation: run it while both keys are
 * configured and the previous key can then be removed. Idempotent — an
 * envelope that already decrypts under the active key is left alone, so a
 * repeated run costs one read and writes nothing.
 *
 * A key that cannot be decrypted is a configuration error rather than a value
 * to replace. Throwing leaves the stored envelope intact, so an operator who
 * rotated with the wrong previous key can set the right one and run again.
 *
 * @public
 */
export async function reencryptNcbiApiKey(
	db: Db,
	keyring: Keyring,
): Promise<Settings> {
	const settings = await getSettings(db);

	if (settings.ncbiApiKey === null) {
		return settings;
	}

	const { apiKey } = resolveNcbiApiKey(settings.ncbiApiKey, keyring);

	if (apiKey === null) {
		throw new NcbiConfigurationError(
			"the stored API key cannot be decrypted with the configured encryption key",
		);
	}

	if (keyring.isCurrent(settings.ncbiApiKey)) {
		return settings;
	}

	return setNcbiApiKey(db, keyring, apiKey);
}
