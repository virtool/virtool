import { useFetchAccount } from "@account/account";
import { downloadText } from "@app/download";
import type { ButtonProps } from "@base/Button";
import {
	DropdownButton,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "@base/Dropdown";
import ExportMenu, { useCopyExport } from "@base/ExportMenu";
import Icon from "@base/Icon";
import {
	FASTA_HEADER_LABELS,
	formatAccessions,
	formatExportFilename,
	formatFasta,
	formatIsolateTable,
	formatSequenceTable,
	getExportSequences,
	TABLE_FORMAT_LABELS,
} from "@otus/export";
import {
	type OtuIsolate,
	type OtuSegment,
	REFERENCE_EXPORT_FASTA_HEADERS,
	REFERENCE_EXPORT_TABLE_FORMATS,
	type ReferenceExportFastaHeader,
	type ReferenceExportTableFormat,
} from "@virtool/contracts";
import { Check, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";

/** One export the menu can copy or download. */
type ExportItem = {
	/** Whether the export has nothing to take */
	disabled: boolean;

	/** The file extension a download is saved with */
	extension: string;

	/** Renders the export; a copy always asks for TSV */
	format: (tableFormat: ReferenceExportTableFormat) => string;

	/** The name the menu shows */
	label: string;

	/** The part of the filename that names this export */
	name: string;

	/** The media type a download is saved with */
	type: (tableFormat: ReferenceExportTableFormat) => string;
};

const TABLE_TYPES: Record<ReferenceExportTableFormat, string> = {
	csv: "text/csv",
	tsv: "text/tab-separated-values",
};

type OtuExportProps = {
	/** Describes the rows the export takes, shown at the top of the menu */
	description: string;

	/** The leading parts of each download's filename */
	filenameParts: string[];

	/** Whether to offer a table with one row per isolate */
	includeIsolateTable: boolean;

	/** The isolates to export, with only the sequences to export */
	isolates: OtuIsolate[];

	/** The OTU the isolates belong to */
	otu: { name: string; schema: OtuSegment[] };

	/** The size of the menu's button */
	size?: ButtonProps["size"];
};

/**
 * The export menu for an OTU or an isolate.
 *
 * The FASTA header and table format follow the account defaults until they are
 * changed here. A change applies only while the page stays open. Copied tables
 * are always TSV, which pastes into a spreadsheet as columns.
 */
export default function OtuExport({
	description,
	filenameParts,
	includeIsolateTable,
	isolates,
	otu,
	size,
}: OtuExportProps) {
	const { data: account } = useFetchAccount();

	const defaultFastaHeader =
		account?.settings.referenceExportFastaHeader ?? "full";
	const defaultTableFormat =
		account?.settings.referenceExportTableFormat ?? "csv";

	const [fastaHeaderOverride, setFastaHeaderOverride] =
		useState<ReferenceExportFastaHeader | null>(null);
	const [tableFormatOverride, setTableFormatOverride] =
		useState<ReferenceExportTableFormat | null>(null);

	const fastaHeader = fastaHeaderOverride ?? defaultFastaHeader;
	const tableFormat = tableFormatOverride ?? defaultTableFormat;

	const { copied, copy } = useCopyExport("otu-export");

	const hasSequences = isolates.some((isolate) => isolate.sequences.length > 0);

	const items: ExportItem[] = [
		{
			disabled: !hasSequences,
			extension: "txt",
			format: () => formatAccessions(getExportSequences(otu, isolates)),
			label: "Accessions",
			name: "accessions",
			type: () => "text/plain",
		},
		{
			disabled: !hasSequences,
			extension: "fa",
			format: () => formatFasta(getExportSequences(otu, isolates), fastaHeader),
			label: "FASTA",
			name: "sequences",
			type: () => "text/plain",
		},
		{
			disabled: !hasSequences,
			extension: tableFormat,
			format: (format) =>
				formatSequenceTable(getExportSequences(otu, isolates), format),
			label: "Sequence table",
			name: "sequences",
			type: (format) => TABLE_TYPES[format],
		},
	];

	if (includeIsolateTable) {
		items.push({
			disabled: isolates.length === 0,
			extension: tableFormat,
			format: (format) => formatIsolateTable(otu, isolates, format),
			label: "Isolate table",
			name: "isolates",
			type: (format) => TABLE_TYPES[format],
		});
	}

	function handleDownload(item: ExportItem) {
		downloadText(
			item.format(tableFormat),
			formatExportFilename([...filenameParts, item.name], item.extension),
			item.type(tableFormat),
		);
	}

	return (
		<ExportMenu
			copyItems={items.map((item) => ({
				disabled: item.disabled,
				label: item.label,
				onSelect: () => copy(item.format("tsv")),
			}))}
			description={description}
			downloadItems={items.map((item) => ({
				disabled: item.disabled,
				icon: item.extension === "txt" ? FileText : FileSpreadsheet,
				label: item.label,
				onSelect: () => handleDownload(item),
			}))}
			id="OtuExport"
			settingsHash="reference-exports"
			trigger={
				<DropdownButton aria-label={copied ? "Copied" : "Export"} size={size}>
					<Icon icon={copied ? Check : Download} />{" "}
					{copied ? "Copied" : "Export"}
				</DropdownButton>
			}
		>
			{/* The radio items stay open when chosen, so the choice can be seen to
				    take before an export is picked. */}
			<DropdownMenuGroup aria-labelledby="OtuExportFastaHeader">
				<DropdownMenuLabel id="OtuExportFastaHeader">
					FASTA header
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={fastaHeader}
					onValueChange={(value) =>
						setFastaHeaderOverride(value as ReferenceExportFastaHeader)
					}
				>
					{REFERENCE_EXPORT_FASTA_HEADERS.map((value) => (
						<DropdownMenuRadioItem
							key={value}
							onSelect={(e) => e.preventDefault()}
							value={value}
						>
							{FASTA_HEADER_LABELS[value]}
							{value === defaultFastaHeader && (
								<>
									{" "}
									<DefaultTag />
								</>
							)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuGroup aria-labelledby="OtuExportTableFormat">
				<DropdownMenuLabel id="OtuExportTableFormat">
					Table download format
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={tableFormat}
					onValueChange={(value) =>
						setTableFormatOverride(value as ReferenceExportTableFormat)
					}
				>
					{REFERENCE_EXPORT_TABLE_FORMATS.map((value) => (
						<DropdownMenuRadioItem
							key={value}
							onSelect={(e) => e.preventDefault()}
							value={value}
						>
							{TABLE_FORMAT_LABELS[value]}
							{value === defaultTableFormat && (
								<>
									{" "}
									<DefaultTag />
								</>
							)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuGroup>
		</ExportMenu>
	);
}

function DefaultTag() {
	return <span className="ml-auto pl-3 text-xs text-gray-500">Default</span>;
}
