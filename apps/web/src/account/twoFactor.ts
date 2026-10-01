import * as Sentry from "@sentry/tanstackstart-react";
import { UNAUTHORIZED_ERROR_NAME } from "@virtool/contracts";

/** The one-time result of starting TOTP enrollment. */
export type TotpEnrollment = {
	/** The codes that replace a lost authenticator; each works once */
	backupCodes: string[];
	/** The `otpauth://` URI that the authenticator app reads */
	totpURI: string;
};

/** The error part of a Better Auth client result. */
type AuthClientError = {
	code?: string;
	status: number;
};

const TWO_FACTOR_ERROR_NAME = "TwoFactorError";

// Messages are fixed strings, so a Better Auth message never reaches the page.
function toTwoFactorError({ code, status }: AuthClientError): Error {
	if (status === 401 && code === "UNAUTHORIZED") {
		return Object.assign(new Error("Unauthorized"), {
			name: UNAUTHORIZED_ERROR_NAME,
		});
	}

	let message = "Something went wrong. Try again.";

	if (code === "INVALID_PASSWORD") {
		message = "The password is not correct.";
	} else if (code === "INVALID_CODE") {
		message = "The code is not correct. Enter the code your app shows now.";
	} else if (status === 429) {
		message = "Too many attempts. Wait and try again.";
	} else {
		Sentry.captureException(new Error("Two-factor request failed"), {
			extra: { code, status },
		});
	}

	return Object.assign(new Error(message), { name: TWO_FACTOR_ERROR_NAME });
}

async function loadAuthClient() {
	const { authClient } = await import("@app/authClient");
	return authClient;
}

/**
 * Start TOTP enrollment.
 *
 * The result is the only time the secret and the recovery codes leave the
 * server. TOTP is not on until {@link confirmTotp} succeeds.
 */
export async function enableTotp(password: string): Promise<TotpEnrollment> {
	const authClient = await loadAuthClient();
	const { data, error } = await authClient.twoFactor.enable({ password });
	if (error) {
		throw toTwoFactorError(error);
	}
	return { backupCodes: data.backupCodes, totpURI: data.totpURI };
}

/** Turn TOTP on with a code from the authenticator app. */
export async function confirmTotp(code: string): Promise<void> {
	const authClient = await loadAuthClient();
	const { error } = await authClient.twoFactor.verifyTotp({ code });
	if (error) {
		throw toTwoFactorError(error);
	}
}

/** Replace every recovery code. The old codes stop working. */
export async function regenerateRecoveryCodes(
	password: string,
): Promise<string[]> {
	const authClient = await loadAuthClient();
	const { data, error } = await authClient.twoFactor.generateBackupCodes({
		password,
	});
	if (error) {
		throw toTwoFactorError(error);
	}
	return data.backupCodes;
}

/** Turn TOTP off. Its secret and recovery codes are deleted. */
export async function disableTotp(password: string): Promise<void> {
	const authClient = await loadAuthClient();
	const { error } = await authClient.twoFactor.disable({ password });
	if (error) {
		throw toTwoFactorError(error);
	}
}

/** Read the setup key from an `otpauth://` URI, for manual entry. */
export function getTotpSecret(totpURI: string): string {
	return new URL(totpURI).searchParams.get("secret") ?? "";
}

/**
 * The message to show for a failed TOTP action.
 *
 * Only messages from this module are shown. Anything else gets a generic
 * message, because it can carry details that are not for the user.
 */
export function getTwoFactorErrorMessage(error: unknown): string {
	if (error instanceof Error && error.name === TWO_FACTOR_ERROR_NAME) {
		return error.message;
	}
	return "Something went wrong. Try again.";
}
