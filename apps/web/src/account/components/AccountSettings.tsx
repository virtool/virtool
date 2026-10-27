import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
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

const FASTA_HEADER_EXAMPLES: Record<ReferenceExportFastaHeader, string> = {
	accession: ">NC_001367",
	full: ">NC_001367|Tobacco mosaic virus|Isolate OM",
};

// The TSV example uses spaces, so the columns line up as a spreadsheet would
// show them.
const TABLE_FORMAT_EXAMPLES: Record<ReferenceExportTableFormat, string> = {
	csv: "OTU,Isolate,Accession\nTobacco mosaic virus,Isolate OM,NC_001367",
	tsv: "OTU                   Isolate     Accession\nTobacco mosaic virus  Isolate OM  NC_001367",
};

type ExportOptionProps = {
	/** A sample of the output this option gives */
	example: string;

	/** The name of the option */
	title: string;

	/** The radio value the option selects */
	value: string;
};

/** A card radio for an export default, with a sample of its output. */
function ExportOption({ example, title, value }: ExportOptionProps) {
	return (
		<FieldLabel variant="card">
			<Field orientation="horizontal" className="items-start">
				<RadioGroupItem className="mt-0.5" value={value} />
				<FieldContent className="min-w-0">
					<FieldTitle>{title}</FieldTitle>
					<pre className="mt-1 overflow-x-auto font-mono text-xs text-gray-600">
						{example}
					</pre>
				</FieldContent>
			</Field>
		</FieldLabel>
	);
}

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
				className="mt-12"
				id="reference-exports"
			>
				<SectionHeader level={3}>
					<h3 id="reference-exports-heading">Reference exports</h3>
					<p>
						Set the defaults for OTU and isolate exports. You can change them in
						the export menu for one export.
					</p>
				</SectionHeader>
				<FieldSet>
					<FieldLegend variant="label">FASTA header</FieldLegend>
					<RadioGroup
						className="grid-cols-2"
						onValueChange={(value) =>
							mutation.mutate({
								referenceExportFastaHeader: value as ReferenceExportFastaHeader,
							})
						}
						value={data.settings.referenceExportFastaHeader}
					>
						{REFERENCE_EXPORT_FASTA_HEADERS.map((value) => (
							<ExportOption
								example={FASTA_HEADER_EXAMPLES[value]}
								key={value}
								title={FASTA_HEADER_LABELS[value]}
								value={value}
							/>
						))}
					</RadioGroup>
				</FieldSet>
				<FieldSet>
					<FieldLegend variant="label">Table download format</FieldLegend>
					<RadioGroup
						className="grid-cols-2"
						onValueChange={(value) =>
							mutation.mutate({
								referenceExportTableFormat: value as ReferenceExportTableFormat,
							})
						}
						value={data.settings.referenceExportTableFormat}
					>
						{REFERENCE_EXPORT_TABLE_FORMATS.map((value) => (
							<ExportOption
								example={TABLE_FORMAT_EXAMPLES[value]}
								key={value}
								title={TABLE_FORMAT_LABELS[value]}
								value={value}
							/>
						))}
					</RadioGroup>
				</FieldSet>
			</section>
		</section>
	);
}
