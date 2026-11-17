import type { PaletteColor } from "@base/types";
import type { EmailAvailability, EmailSettings } from "@virtool/contracts";
import type { LucideIcon } from "lucide-react";
import {
	CircleAlert,
	CircleCheck,
	CircleSlash,
	TriangleAlert,
} from "lucide-react";

/** How the email delivery status is drawn. */
type StatusPresentation = {
	color: PaletteColor;
	icon: LucideIcon;
	label: string;
};

const presentations: Record<
	EmailAvailability | "disabled",
	StatusPresentation
> = {
	configuration_error: {
		color: "red",
		icon: TriangleAlert,
		label: "Configuration Error",
	},
	disabled: { color: "gray", icon: CircleSlash, label: "Disabled" },
	ready: { color: "green", icon: CircleCheck, label: "Active" },
	unconfigured: {
		color: "orange",
		icon: CircleAlert,
		label: "Needs Configuration",
	},
};

/** Name the fields an unconfigured instance is still missing. */
export function listMissingFields(settings: EmailSettings): string {
	const missing = [
		settings.hasApiKey ? null : "an API key",
		settings.senderAddress === "" ? "a sender address" : null,
	].filter((field) => field !== null);

	return missing.join(" and ");
}

/**
 * How to draw an instance's email delivery status. A ready instance with
 * sending turned off reads as disabled.
 */
export function getEmailStatusPresentation(
	settings: Pick<EmailSettings, "availability" | "enabled">,
): StatusPresentation {
	return settings.availability === "ready" && !settings.enabled
		? presentations.disabled
		: presentations[settings.availability];
}
