import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@base/Field";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";
import SectionHeader from "@base/SectionHeader";
import Switch from "@base/Switch";
import { FASTA_HEADER_LABELS, TABLE_FORMAT_LABELS } from "@otus/export";
import {
	REFERENCE_EXPORT_FASTA_HEADERS,
	REFERENCE_EXPORT_TABLE_FORMATS,
	type ReferenceExportFastaHeader,
	type ReferenceExportTableFormat,
} from "@virtool/contracts";
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
					<h3 id="pathoscope-heading">Pathoscope export</h3>
					<p>Change how Pathoscope results are copied and downloaded.</p>
				</SectionHeader>
				<BoxGroup>
					<BoxGroupSection>
						<FieldLabel variant="row">
							<Field className="flex-1 gap-5" orientation="horizontal">
								<FieldContent>
									<FieldTitle className="font-semibold">
										Prefer acronym
									</FieldTitle>
									<FieldDescription>
										Name OTUs by their acronym when they have one.
									</FieldDescription>
								</FieldContent>
								<Switch
									checked={data.settings.preferAcronym}
									onCheckedChange={(checked) =>
										mutation.mutate({ preferAcronym: checked })
									}
								/>
							</Field>
						</FieldLabel>
						{mutation.isError ? (
							<p className="text-red-600 text-sm" role="alert">
								Could not save the setting. Try again.
							</p>
						) : null}
					</BoxGroupSection>
				</BoxGroup>
				<div className="mt-5 mb-3">
					<p className="font-semibold" id="pathoscopeColumns-label">
						Column order
					</p>
				</div>
				<PathoscopeColumns
					columns={data.settings.pathoscopeColumns}
					onChange={(pathoscopeColumns, options) =>
						mutation.mutate({ pathoscopeColumns }, options)
					}
				/>
			</section>
			<section
				aria-labelledby="reference-exports-heading"
				id="reference-exports"
			>
				<SectionHeader level={3}>
					<h3 id="reference-exports-heading">Reference exports</h3>
					<p>
						Set the defaults for OTU and isolate exports. You can change them in
						the export menu for one export.
					</p>
				</SectionHeader>
				<BoxGroup>
					<BoxGroupSection>
						<p
							className="mb-3 font-semibold"
							id="referenceExportFastaHeader-label"
						>
							FASTA header
						</p>
						<RadioGroup
							aria-labelledby="referenceExportFastaHeader-label"
							onValueChange={(value) =>
								mutation.mutate({
									referenceExportFastaHeader:
										value as ReferenceExportFastaHeader,
								})
							}
							value={data.settings.referenceExportFastaHeader}
						>
							{REFERENCE_EXPORT_FASTA_HEADERS.map((value) => (
								<FieldLabel key={value}>
									<Field orientation="horizontal">
										<RadioGroupItem value={value} />
										<FieldTitle>{FASTA_HEADER_LABELS[value]}</FieldTitle>
									</Field>
								</FieldLabel>
							))}
						</RadioGroup>
					</BoxGroupSection>
					<BoxGroupSection>
						<p
							className="mb-3 font-semibold"
							id="referenceExportTableFormat-label"
						>
							Table download format
						</p>
						<RadioGroup
							aria-labelledby="referenceExportTableFormat-label"
							onValueChange={(value) =>
								mutation.mutate({
									referenceExportTableFormat:
										value as ReferenceExportTableFormat,
								})
							}
							value={data.settings.referenceExportTableFormat}
						>
							{REFERENCE_EXPORT_TABLE_FORMATS.map((value) => (
								<FieldLabel key={value}>
									<Field orientation="horizontal">
										<RadioGroupItem value={value} />
										<FieldTitle>{TABLE_FORMAT_LABELS[value]}</FieldTitle>
									</Field>
								</FieldLabel>
							))}
						</RadioGroup>
					</BoxGroupSection>
				</BoxGroup>
			</section>
		</section>
	);
}
