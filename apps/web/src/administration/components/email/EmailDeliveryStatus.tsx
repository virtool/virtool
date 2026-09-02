import Alert from "@base/Alert";
import ExternalLink from "@base/ExternalLink";
import type { PaletteColor } from "@base/types";
import type { EmailAvailability, EmailSettings } from "@virtool/contracts";
import type { LucideIcon } from "lucide-react";
import {
	CircleAlert,
	CircleCheck,
	CircleSlash,
	TriangleAlert,
} from "lucide-react";

const ENCRYPTION_KEY_DOCS =
	"https://github.com/virtool/virtool/blob/main/docs/env.md#encryption-key";

type StatusPresentation = {
	color: PaletteColor;
	icon: LucideIcon;
	label: string;
};

const presentations: Record<EmailAvailability, StatusPresentation> = {
	configuration_error: {
		color: "red",
		icon: TriangleAlert,
		label: "Configuration error",
	},
	disabled: { color: "gray", icon: CircleSlash, label: "Disabled" },
	ready: { color: "green", icon: CircleCheck, label: "Ready" },
	unconfigured: {
		color: "orange",
		icon: CircleAlert,
		label: "Needs configuration",
	},
};

/** Name the fields an unconfigured instance is still missing. */
function listMissingFields(settings: EmailSettings): string {
	const missing = [
		settings.hasApiKey ? null : "an API key",
		settings.senderAddress === "" ? "a sender address" : null,
	].filter((field) => field !== null);

	return missing.join(" and ");
}

function Detail({ settings }: { settings: EmailSettings }) {
	switch (settings.availability) {
		case "configuration_error":
			return (
				<p>
					The stored API key cannot be read with the encryption key this
					instance is running with. The key is still stored and has not been
					changed. Restore the encryption key, or complete the rotation, by
					following{" "}
					<ExternalLink className="underline" href={ENCRYPTION_KEY_DOCS}>
						the encryption key guide
					</ExternalLink>
					. Saving a replacement API key is the other way out, and it cannot be
					undone by reading the old one.
				</p>
			);

		case "disabled":
			return (
				<p>
					The configuration is kept, but nothing queued will be sent while
					delivery is off.
				</p>
			);

		case "ready":
			return <p>Queued mail is being sent with the configuration below.</p>;

		case "unconfigured":
			return <p>Email delivery still needs {listMissingFields(settings)}.</p>;
	}
}

/**
 * Say whether email delivery works, and what to do when it does not.
 *
 * The four states are distinct on purpose. A key that cannot be decrypted is
 * never reported as a missing key: the stored value is intact, and the fix is
 * the encryption key rather than the API key.
 */
export default function EmailDeliveryStatus({
	settings,
}: {
	settings: EmailSettings;
}) {
	const { color, icon, label } = presentations[settings.availability];

	return (
		<Alert color={color} icon={icon} outerClassName="mb-0">
			<div aria-label="email delivery status" role="status">
				<h3 className="font-semibold">{label}</h3>
				<Detail settings={settings} />
			</div>
		</Alert>
	);
}
