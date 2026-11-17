import { useSetMfaPolicy, useSuspenseSettings } from "@administration/queries";
import { isRecentAuthenticationCancelled } from "@app/recentAuthentication";
import SectionHeader from "@base/SectionHeader";
import { CLIENT_ERROR_NAME } from "@virtool/contracts";
import SettingsCheckbox from "./SettingsCheckbox";

function getErrorMessage(error: Error | null): string | null {
	if (!error || isRecentAuthenticationCancelled(error)) {
		return null;
	}
	return error.name === CLIENT_ERROR_NAME && error.message
		? error.message
		: "The policy could not be changed. Try again.";
}

/** The instance setting that makes every user turn on TOTP or add a passkey. */
export default function MfaPolicy() {
	const { data } = useSuspenseSettings();
	const mutation = useSetMfaPolicy();
	const required = data.mfaPolicy === "required";
	const errorMessage = getErrorMessage(mutation.error);

	function onToggle() {
		mutation.mutate(required ? "optional" : "required");
	}

	return (
		<section className="flex flex-col gap-4">
			<SectionHeader className="mb-0">
				<h2>Security</h2>
			</SectionHeader>
			<section>
				<SectionHeader level={3}>
					<h3>Two-Factor Authentication</h3>
				</SectionHeader>
				<SettingsCheckbox
					description="Users without two-factor authentication or a passkey must set up two-factor authentication before they can use Virtool. You must turn on two-factor authentication or add a passkey for your own account first."
					disabled={mutation.isPending}
					enabled={required}
					onToggle={onToggle}
					title="Require two-factor authentication"
				/>
				{errorMessage && (
					<p role="alert" className="mt-2 font-medium text-red-600">
						{errorMessage}
					</p>
				)}
			</section>
		</section>
	);
}
