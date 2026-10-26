import { useFetchAccount } from "@account/account";
import { useUpdateAccountSettings } from "@account/queries";
import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { useSortAndFilterPathoscopeHits } from "@analyses/hooks";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { DropdownButton, DropdownMenuCheckboxItem } from "@base/Dropdown";
import ExportMenu, { useCopyExport } from "@base/ExportMenu";
import Icon from "@base/Icon";
import Tooltip from "@base/Tooltip";
import {
	PATHOSCOPE_COLUMNS,
	type PathoscopeColumn,
	type PathoscopeHit,
} from "@virtool/contracts";
import { Check, Download, FileSpreadsheet } from "lucide-react";
import { collapsingLabel } from "./collapsingLabel";
import {
	formatPathoscopeHitsAsTsv,
	formatPathoscopeIsolatesAsTsv,
} from "./table";

type CopyItem = {
	format: (
		hits: PathoscopeHit[],
		options: {
			columns: PathoscopeColumn[];
			headers: boolean;
			mappedCount: number;
			preferAcronym: boolean;
			showReads: boolean;
		},
	) => string;
	headers: boolean;
	label: string;
};

const copyItems: CopyItem[] = [
	{ format: formatPathoscopeHitsAsTsv, headers: true, label: "OTUs" },
	{
		format: formatPathoscopeHitsAsTsv,
		headers: false,
		label: "OTUs without headers",
	},
	{ format: formatPathoscopeIsolatesAsTsv, headers: true, label: "Isolates" },
	{
		format: formatPathoscopeIsolatesAsTsv,
		headers: false,
		label: "Isolates without headers",
	},
];

type PathoscopeExportProps = {
	analysis: FormattedPathoscopeAnalysis;
};

/**
 * The export menu.
 *
 * A copy takes what the search and filters left on screen; a download is the
 * entire analysis, sequence by sequence, as the server renders it. Both carry
 * the account's columns in its order, and name OTUs by acronym when the
 * account prefers it and the OTU has one.
 */
export default function PathoscopeExport({ analysis }: PathoscopeExportProps) {
	const hits = useSortAndFilterPathoscopeHits(analysis);
	const { search } = useAnalysisSearch();
	const showReads = search.reads;
	const { data: account } = useFetchAccount();
	const { mutate: updateSettings } = useUpdateAccountSettings();

	const columns = account?.settings.pathoscopeColumns ?? [
		...PATHOSCOPE_COLUMNS,
	];
	const preferAcronym = account?.settings.preferAcronym ?? false;
	// Column names are fixed identifiers, so the list needs no encoding.
	const downloadQuery = `?columns=${columns.join(",")}${preferAcronym ? "&preferAcronym=true" : ""}`;

	const { copied, copy } = useCopyExport("pathoscope-export");

	return (
		<ExportMenu
			copyItems={copyItems.map(({ format, headers, label }) => ({
				label,
				onSelect: () =>
					copy(
						format(hits, {
							columns,
							headers,
							mappedCount: analysis.results.readCount,
							preferAcronym,
							showReads,
						}),
					),
			}))}
			downloadItems={[
				{
					href: `/analyses/documents/${analysis.id}.xlsx${downloadQuery}`,
					icon: FileSpreadsheet,
					label: "Excel",
				},
				{
					href: `/analyses/documents/${analysis.id}.csv${downloadQuery}`,
					icon: FileSpreadsheet,
					label: "CSV",
				},
			]}
			id="PathoscopeExport"
			settingsHash="pathoscope"
			trigger={
				<Tooltip tip="Export results">
					<DropdownButton aria-label={copied ? "Copied" : "Export"}>
						<Icon icon={copied ? Check : Download} />
						<span className={collapsingLabel}>
							{copied ? "Copied" : "Export"}
						</span>
					</DropdownButton>
				</Tooltip>
			}
		>
			{/* Stays open when toggled, so the choice can be seen to take before an
				    export is picked. */}
			<DropdownMenuCheckboxItem
				checked={preferAcronym}
				onCheckedChange={(checked) =>
					updateSettings({ preferAcronym: checked === true })
				}
				onSelect={(e) => e.preventDefault()}
			>
				Prefer acronym
			</DropdownMenuCheckboxItem>
		</ExportMenu>
	);
}
