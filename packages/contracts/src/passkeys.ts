import { z } from "zod";

/** Longest passkey name, in characters, after whitespace is normalized. */
export const PASSKEY_NAME_MAX_LENGTH = 64;

/** The name a passkey gets when the authenticator reports no known provider. */
export const DEFAULT_PASSKEY_NAME = "Passkey";

// C0 and C1 control characters. Whitespace ones never reach this check,
// because normalization has already replaced them with spaces.
function hasControlCharacter(name: string): boolean {
	for (const character of name) {
		const code = character.codePointAt(0) ?? 0;
		if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
			return true;
		}
	}
	return false;
}

/** Replace each run of whitespace in a passkey name with one space, and trim it. */
export function normalizePasskeyName(name: string): string {
	return name.replace(/\s+/g, " ").trim();
}

/** Validates and normalizes a user-chosen passkey name. */
export const passkeyNameSchema = z
	.string()
	.transform(normalizePasskeyName)
	.pipe(
		z
			.string()
			.min(1, "Enter a name.")
			.max(
				PASSKEY_NAME_MAX_LENGTH,
				`Use at most ${PASSKEY_NAME_MAX_LENGTH} characters.`,
			)
			.refine((name) => !hasControlCharacter(name), {
				message: "Remove control characters from the name.",
			}),
	);

/** A redacted, display-only summary of one of the current user's passkeys. */
export type PasskeySummary = {
	/** Opaque database identity used only to manage the passkey. */
	managementId: number;
	name: string;
	createdAt: Date | null;
	/** Whether the credential can be synced across devices. */
	multiDevice: boolean;
	/** Whether the authenticator reported the credential as backed up. */
	backedUp: boolean;
};
