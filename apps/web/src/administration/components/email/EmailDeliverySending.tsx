import { useUpdateEmailSettings } from "@administration/queries";
import { BoxGroupSection } from "@base/Box";
import Switch from "@base/Switch";
import type { EmailSettings } from "@virtool/contracts";
import { getEmailErrorMessage } from "./errors";

/** Control whether this instance accepts new email for delivery. */
export default function EmailDeliverySending({
	settings,
}: {
	settings: EmailSettings;
}) {
	const mutation = useUpdateEmailSettings();
	const canEnable = settings.availability === "ready";

	function update(enabled: boolean) {
		mutation.mutate({ enabled });
	}

	return (
		<BoxGroupSection>
			<div className="flex items-center justify-between gap-5">
				<div>
					<p className="font-semibold">Enable</p>
					<p className="text-gray-600 text-sm">
						New email is not sent when disabled.
					</p>
					{mutation.isError ? (
						<p className="text-red-600 text-sm" role="alert">
							{getEmailErrorMessage(mutation.error)}
						</p>
					) : null}
				</div>
				<Switch
					aria-label="Send email"
					checked={settings.enabled}
					disabled={(!settings.enabled && !canEnable) || mutation.isPending}
					onCheckedChange={update}
				/>
			</div>
		</BoxGroupSection>
	);
}
