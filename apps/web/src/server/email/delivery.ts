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

/** The public link that proves a user owns an email address. */
export function getVerificationUrl(token: string): string {
	return `${config.publicOrigin}/verify-email#token=${token}`;
}
