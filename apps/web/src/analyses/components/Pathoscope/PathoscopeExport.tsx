import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { useSortAndFilterPathoscopeHits } from "@analyses/hooks";
import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { writeToClipboard } from "@app/clipboard";
import { useIsSecureContext } from "@app/hooks";
import Dropdown from "@base/Dropdown";
import DropdownButton from "@base/DropdownButton";
import DropdownMenuContent from "@base/DropdownMenuContent";
import DropdownMenuDownload from "@base/DropdownMenuDownload";
import DropdownMenuGroup from "@base/DropdownMenuGroup";
import DropdownMenuItem from "@base/DropdownMenuItem";
import DropdownMenuLabel from "@base/DropdownMenuLabel";
import DropdownMenuSeparator from "@base/DropdownMenuSeparator";
import Icon from "@base/Icon";
import Tooltip from "@base/Tooltip";
import * as Sentry from "@sentry/tanstackstart-react";
import type { PathoscopeHit } from "@virtool/contracts";
import { Check, ClipboardCopy, Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { collapsingLabel } from "./collapsingLabel";
import {
	formatPathoscopeHitsAsTsv,
	formatPathoscopeIsolatesAsTsv,
} from "./table";

type CopyItem = {
	format: (
		hits: PathoscopeHit[],
		options: { headers: boolean; mappedCount: number; showReads: boolean },
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
 * entire analysis, sequence by sequence, as the server renders it.
 */
export default function PathoscopeExport({ analysis }: PathoscopeExportProps) {
	const hits = useSortAndFilterPathoscopeHits(analysis);
	const { search } = useAnalysisSearch();
	const showReads = search.reads;
	const isSecureContext = useIsSecureContext();

	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) {
			return;
		}

		const timeout = setTimeout(() => setCopied(false), 2000);

		return () => clearTimeout(timeout);
	}, [copied]);

	// Only a resolved write flips the label, so a rejected one — a revoked
	// permission, an unfocused document — cannot claim the table was copied.
	function handleCopy({ format, headers }: CopyItem) {
		writeToClipboard(
			format(hits, {
				headers,
				mappedCount: analysis.results.readCount,
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
						href={`/analyses/documents/${analysis.id}.xlsx`}
					>
						<Icon icon={FileSpreadsheet} /> Excel
					</DropdownMenuDownload>
					<DropdownMenuDownload href={`/analyses/documents/${analysis.id}.csv`}>
						<Icon icon={FileSpreadsheet} /> CSV
					</DropdownMenuDownload>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</Dropdown>
	);
}
