import { useUpdateEmailSettings } from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Switch from "@base/Switch";
import type { EmailSettings } from "@virtool/contracts";
import { getEmailErrorMessage } from "./errors";

/** Control whether queued email is sent. */
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
		<BoxGroup>
			<BoxGroupSection>
				<div className="flex items-center justify-between gap-5">
					<div>
						<p className="font-semibold">Send email</p>
						<p className="text-gray-600 text-sm">
							{settings.enabled
								? "Queued email is currently being sent."
								: "Email is configured but sending is turned off."}
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
		</BoxGroup>
	);
}
