import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldDescription, FieldLabel } from "@base/Field";
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
					<Field className="justify-between gap-5" orientation="horizontal">
						<div>
							<FieldLabel className="mb-0 block font-semibold">
								Prefer acronyms in Pathoscope exports
							</FieldLabel>
							<FieldDescription className="mt-0">
								Name OTUs by their acronym when they have one.
							</FieldDescription>
							{mutation.isError ? (
								<p className="text-red-600 text-sm" role="alert">
									Could not save the setting. Try again.
								</p>
							) : null}
						</div>
						<Switch
							checked={data.settings.preferAcronym}
							onCheckedChange={(checked) =>
								mutation.mutate({ preferAcronym: checked })
							}
						/>
					</Field>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
