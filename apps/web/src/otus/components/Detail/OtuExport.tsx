import { useFetchAccount } from "@account/account";
import { writeToClipboard } from "@app/clipboard";
import { downloadText } from "@app/download";
import { useIsSecureContext, useTimedReset } from "@app/hooks";
import Dropdown, {
	DropdownButton,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuLink,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "@base/Dropdown";
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
import * as Sentry from "@sentry/tanstackstart-react";
import {
	type OtuIsolate,
	type OtuSegment,
	REFERENCE_EXPORT_FASTA_HEADERS,
	REFERENCE_EXPORT_TABLE_FORMATS,
	type ReferenceExportFastaHeader,
	type ReferenceExportTableFormat,
} from "@virtool/contracts";
import {
	Check,
	ClipboardCopy,
	Download,
	FileSpreadsheet,
	FileText,
	Settings,
} from "lucide-react";
import { useState } from "react";

/** One export the menu can copy or download. */
type ExportItem = {
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
}: OtuExportProps) {
	const isSecureContext = useIsSecureContext();
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

	const [copied, setCopied] = useState(false);

	useTimedReset(copied, () => setCopied(false));

	const sequences = getExportSequences(otu, isolates);
	const empty = sequences.length === 0;

	const items: ExportItem[] = [
		{
			extension: "txt",
			format: () => formatAccessions(sequences),
			label: "Accessions",
			name: "accessions",
			type: () => "text/plain",
		},
		{
			extension: "fa",
			format: () => formatFasta(sequences, fastaHeader),
			label: "FASTA",
			name: "sequences",
			type: () => "text/plain",
		},
		{
			extension: tableFormat,
			format: (format) => formatSequenceTable(sequences, format),
			label: "Sequence table",
			name: "sequences",
			type: (format) => TABLE_TYPES[format],
		},
	];

	if (includeIsolateTable) {
		items.push({
			extension: tableFormat,
			format: (format) => formatIsolateTable(otu, isolates, format),
			label: "Isolate table",
			name: "isolates",
			type: (format) => TABLE_TYPES[format],
		});
	}

	// Only a resolved write flips the label, so a rejected one — a revoked
	// permission, an unfocused document — cannot claim the export was copied.
	function handleCopy(item: ExportItem) {
		writeToClipboard(item.format("tsv")).then(
			() => setCopied(true),
			(error) =>
				Sentry.captureException(error, {
					tags: { clipboard: "otu-export" },
				}),
		);
	}

	function handleDownload(item: ExportItem) {
		downloadText(
			item.format(tableFormat),
			formatExportFilename([...filenameParts, item.name], item.extension),
			item.type(tableFormat),
		);
	}

	return (
		<Dropdown>
			<DropdownButton aria-label={copied ? "Copied" : "Export"}>
				<Icon icon={copied ? Check : Download} /> {copied ? "Copied" : "Export"}
			</DropdownButton>
			<DropdownMenuContent align="end">
				<p className="px-2 py-1.5 text-xs text-gray-500">{description}</p>
				<DropdownMenuSeparator />
				{/* The clipboard API is unavailable outside a secure context. */}
				{isSecureContext && (
					<>
						<DropdownMenuGroup aria-labelledby="OtuExportCopy">
							<DropdownMenuLabel id="OtuExportCopy">Copy</DropdownMenuLabel>
							{items.map((item) => (
								<DropdownMenuItem
									disabled={empty}
									key={item.label}
									onSelect={() => handleCopy(item)}
								>
									<Icon icon={ClipboardCopy} /> {item.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuGroup aria-labelledby="OtuExportDownload">
					<DropdownMenuLabel id="OtuExportDownload">Download</DropdownMenuLabel>
					{items.map((item) => (
						<DropdownMenuItem
							disabled={empty}
							key={item.label}
							onSelect={() => handleDownload(item)}
						>
							<Icon
								icon={item.extension === "txt" ? FileText : FileSpreadsheet}
							/>{" "}
							{item.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
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
				<DropdownMenuSeparator />
				<DropdownMenuLink hash="reference-exports" to="/account/settings">
					<Icon icon={Settings} /> Settings
				</DropdownMenuLink>
			</DropdownMenuContent>
		</Dropdown>
	);
}

function DefaultTag() {
	return <span className="ml-auto pl-3 text-xs text-gray-500">Default</span>;
}
