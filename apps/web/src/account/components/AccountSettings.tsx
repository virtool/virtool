import { BoxGroup, BoxGroupSection } from "@base/Box";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import Switch from "@base/Switch";
import { useFetchAccount } from "../account";
import { useUpdateAccountSettings } from "../queries";

/**
 * Preferences that change how Virtool behaves for the signed-in user
 */
export default function AccountSettings() {
	const { data, isPending, isError } = useFetchAccount();
	const mutation = useUpdateAccountSettings();

	if (isError && !data) {
		return <QueryError noun="your settings" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	return (
		<section>
			<SectionHeader>
				<h2>Settings</h2>
				<p>Change how Virtool behaves for your account.</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<div className="flex items-center justify-between gap-5">
						<div>
							<p className="font-semibold" id="preferAbbreviation-label">
								Prefer abbreviations in Pathoscope exports
							</p>
							<p className="text-gray-600 text-sm">
								Name OTUs by their abbreviation when they have one.
							</p>
							{mutation.isError ? (
								<p className="text-red-600 text-sm" role="alert">
									Could not save the setting. Try again.
								</p>
							) : null}
						</div>
						<Switch
							aria-labelledby="preferAbbreviation-label"
							checked={data.settings.preferAbbreviation}
							onCheckedChange={(checked) =>
								mutation.mutate({ preferAbbreviation: checked })
							}
						/>
					</div>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
