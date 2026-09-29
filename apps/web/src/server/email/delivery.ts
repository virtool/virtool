import {
	getEmailSettings,
	resolveEmailDelivery,
} from "@virtool/data/email/settings";
import { db, keyring } from "../composition";
import { config } from "../config";

/** Whether email is enabled and its delivery is ready now. */
export async function isEmailDeliveryAvailable(): Promise<boolean> {
	const settings = await getEmailSettings(db);
	return (
		settings.enabled &&
		resolveEmailDelivery(settings, keyring).availability === "ready"
	);
}

/**
 * A link to `path` on the public origin, with `params` in the fragment.
 *
 * Browsers do not send the fragment, so a token in it stays out of server and
 * proxy request logs.
 */
export function getPublicLink(
	path: string,
	params: Record<string, string | undefined>,
): string {
	const url = new URL(path, config.publicOrigin);
	const fragment = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			fragment.set(key, value);
		}
	}
	url.hash = fragment.toString();
	return url.toString();
}

/** The public link that proves a user owns an email address. */
export function getVerificationUrl(token: string): string {
	return getPublicLink("/verify-email", { token });
}
