import { useUpdateEmailSettings } from "@administration/queries";
import { BoxGroupSection } from "@base/Box";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@base/Field";
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
			<FieldLabel variant="row">
				<Field className="flex-1 gap-5" orientation="horizontal">
					<FieldContent>
						<FieldTitle className="font-semibold">Enable</FieldTitle>
						<FieldDescription>
							New email is not sent when disabled.
						</FieldDescription>
					</FieldContent>
					<Switch
						aria-label="Send email"
						checked={settings.enabled}
						disabled={(!settings.enabled && !canEnable) || mutation.isPending}
						onCheckedChange={update}
					/>
				</Field>
			</FieldLabel>
			{mutation.isError ? (
				<p className="text-red-600 text-sm" role="alert">
					{getEmailErrorMessage(mutation.error)}
				</p>
			) : null}
		</BoxGroupSection>
	);
}
