import { useFetchAccount } from "@account/account";
import { useUpdateAccountSettings } from "@account/queries";
import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { useSortAndFilterPathoscopeHits } from "@analyses/hooks";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { writeToClipboard } from "@app/clipboard";
import { useIsSecureContext, useTimedReset } from "@app/hooks";
import Dropdown, {
	DropdownButton,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuDownload,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuLink,
	DropdownMenuSeparator,
} from "@base/Dropdown";
import Icon from "@base/Icon";
import Tooltip from "@base/Tooltip";
import * as Sentry from "@sentry/tanstackstart-react";
import {
	PATHOSCOPE_COLUMNS,
	type PathoscopeColumn,
	type PathoscopeHit,
} from "@virtool/contracts";
import {
	Check,
	ClipboardCopy,
	Download,
	FileSpreadsheet,
	Settings,
} from "lucide-react";
import { useState } from "react";
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
 * entire analysis, sequence by sequence, as the server renders it. Both name
 * OTUs by acronym when the account prefers it and the OTU has one.
 */
export default function PathoscopeExport({ analysis }: PathoscopeExportProps) {
	const hits = useSortAndFilterPathoscopeHits(analysis);
	const { search } = useAnalysisSearch();
	const showReads = search.reads;
	const isSecureContext = useIsSecureContext();
	const { data: account } = useFetchAccount();
	const { mutate: updateSettings } = useUpdateAccountSettings();

	const columns = account?.settings.pathoscopeColumns ?? [
		...PATHOSCOPE_COLUMNS,
	];
	const preferAcronym = account?.settings.preferAcronym ?? false;
	const downloadQuery = preferAcronym ? "?preferAcronym=true" : "";

	const [copied, setCopied] = useState(false);

	useTimedReset(copied, () => setCopied(false));

	// Only a resolved write flips the label, so a rejected one — a revoked
	// permission, an unfocused document — cannot claim the table was copied.
	function handleCopy({ format, headers }: CopyItem) {
		writeToClipboard(
			format(hits, {
				columns,
				headers,
				mappedCount: analysis.results.readCount,
				preferAcronym,
				showReads,
			}),
		).then(
			() => setCopied(true),
			(error) =>
				Sentry.captureException(error, {
					tags: { clipboard: "pathoscope-export" },
				}),
		);
	}

	return (
		<Dropdown>
			<Tooltip tip="Export results">
				<DropdownButton aria-label={copied ? "Copied" : "Export"}>
					<Icon icon={copied ? Check : Download} />
					<span className={collapsingLabel}>
						{copied ? "Copied" : "Export"}
					</span>
				</DropdownButton>
			</Tooltip>
			{/* Opens leftward: the trigger is the last control in the toolbar, so a
			    menu aligned to its start edge runs into the scrollbar. */}
			<DropdownMenuContent align="end">
				{/* The clipboard API is unavailable outside a secure context. */}
				{isSecureContext && (
					<>
						<DropdownMenuGroup aria-labelledby="PathoscopeExportCopy">
							<DropdownMenuLabel id="PathoscopeExportCopy">
								Copy
							</DropdownMenuLabel>
							{copyItems.map((item) => (
								<DropdownMenuItem
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
				<DropdownMenuGroup aria-labelledby="PathoscopeExportDownload">
					<DropdownMenuLabel id="PathoscopeExportDownload">
						Download
					</DropdownMenuLabel>
					<DropdownMenuDownload
						href={`/analyses/documents/${analysis.id}.xlsx${downloadQuery}`}
					>
						<Icon icon={FileSpreadsheet} /> Excel
					</DropdownMenuDownload>
					<DropdownMenuDownload
						href={`/analyses/documents/${analysis.id}.csv${downloadQuery}`}
					>
						<Icon icon={FileSpreadsheet} /> CSV
					</DropdownMenuDownload>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
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
				<DropdownMenuSeparator />
				<DropdownMenuLink hash="pathoscope" to="/account/settings">
					<Icon icon={Settings} /> Settings
				</DropdownMenuLink>
			</DropdownMenuContent>
		</Dropdown>
	);
}
