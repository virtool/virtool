import * as argon2 from "@node-rs/argon2";
import bcrypt from "bcrypt";

// The OWASP Argon2id baseline: 19 MiB of memory, two passes, one lane. A hash
// made with other parameters still verifies, and `needsRehash` replaces it.
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

const CURRENT_PREFIX = `$argon2id$v=19$m=${ARGON2_OPTIONS.memoryCost},t=${ARGON2_OPTIONS.timeCost},p=${ARGON2_OPTIONS.parallelism}$`;

const ARGON2ID_PATTERN =
	/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

// Legacy hashes. Virtool made them at cost 12, and they verify until a
// sign-in replaces them.
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * An Argon2id hash made with the current parameters.
 *
 * Verify against it when there is no stored hash, so that a request for an
 * account that does not exist takes as long as one for an account that does.
 */
export const TIMING_DUMMY_HASH = Buffer.from(
	"$argon2id$v=19$m=19456,t=2,p=1$B/NQKtSk56aqsn1lhUN3Pw$5ZVrjZalUq6AtfQvQ1Sw3UynDTGIxOx9GsZPg0xlXOc",
	"utf8",
);

export async function hashPassword(plain: string): Promise<Buffer> {
	return Buffer.from(await argon2.hash(plain, ARGON2_OPTIONS), "utf8");
}

export async function verifyPassword(
	plain: string,
	hash: Buffer,
): Promise<boolean> {
	const encoded = hash.toString("utf8");

	if (ARGON2ID_PATTERN.test(encoded)) {
		return argon2.verify(encoded, plain);
	}

	if (BCRYPT_PATTERN.test(encoded)) {
		return bcrypt.compare(plain, encoded);
	}

	return false;
}

/** Report whether stored password bytes decode to a hash Virtool can verify. */
export function isPasswordHash(hash: Buffer | null): boolean {
	if (hash === null) {
		return false;
	}

	const encoded = hash.toString("utf8");

	return ARGON2ID_PATTERN.test(encoded) || BCRYPT_PATTERN.test(encoded);
}

/** Report whether a verifiable hash was made by an outdated algorithm or with outdated parameters. */
export function needsRehash(hash: Buffer): boolean {
	return !hash.toString("utf8").startsWith(CURRENT_PREFIX);
}
