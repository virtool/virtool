import { BoxGroup, BoxGroupSection } from "@base/Box";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import Switch from "@base/Switch";
import { useFetchAccount } from "../account";
import { useUpdateAccountSettings } from "../queries";
import PathoscopeColumns from "./PathoscopeColumns";

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
			<section aria-labelledby="pathoscope-heading" id="pathoscope">
				<SectionHeader level={3}>
					<h3 id="pathoscope-heading">Pathoscope</h3>
					<p>Change how Pathoscope results are named and exported.</p>
				</SectionHeader>
				<BoxGroup>
					<BoxGroupSection>
						<div className="flex items-center justify-between gap-5">
							<div>
								<p className="font-semibold" id="preferAcronym-label">
									Prefer acronyms
								</p>
								<p className="text-gray-600 text-sm">
									Name OTUs by their acronym when they have one.
								</p>
								{mutation.isError ? (
									<p className="text-red-600 text-sm" role="alert">
										Could not save the setting. Try again.
									</p>
								) : null}
							</div>
							<Switch
								aria-labelledby="preferAcronym-label"
								checked={data.settings.preferAcronym}
								onCheckedChange={(checked) =>
									mutation.mutate({ preferAcronym: checked })
								}
							/>
						</div>
					</BoxGroupSection>
				</BoxGroup>
				<div className="mt-5 mb-3">
					<p className="font-semibold" id="pathoscopeColumns-label">
						Copy columns
					</p>
					<p className="text-gray-600 text-sm">
						Drag columns into order. Hidden columns are left out of copies.
					</p>
				</div>
				<PathoscopeColumns
					columns={data.settings.pathoscopeColumns}
					onChange={(pathoscopeColumns, options) =>
						mutation.mutate({ pathoscopeColumns }, options)
					}
				/>
			</section>
		</section>
	);
}
