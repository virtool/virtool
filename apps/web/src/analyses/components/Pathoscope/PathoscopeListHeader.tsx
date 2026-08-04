import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import { useIsSecureContext } from "@app/hooks";
import Button from "@base/Button";
import Checkbox from "@base/Checkbox";
import Icon from "@base/Icon";
import * as Sentry from "@sentry/tanstackstart-react";
import { Check, ClipboardCopy } from "lucide-react";
import { useEffect, useState } from "react";

type PathoscopeListHeaderProps = {
	/** Whether every, some, or no hit is selected */
	checked: boolean | "indeterminate";

	/** The number of hits shown */
	found: number;

	/** Copies the selected hits to the clipboard */
	onCopy: () => Promise<void>;

	/** Callback to select or deselect every hit */
	onSelectAll: () => void;

	/** The number of selected hits, which the actions apply to */
	selectedCount: number;

	/** Whether any hit on screen carries an abbreviation to label */
	showAbbreviation: boolean;

	/** The number of hits before the search and filters narrowed them */
	total: number;
};

/**
 * The count of what is on screen, against the whole list when something is
 * being held back.
 *
 * The hidden hits are the ones a reader cannot see to ask about, so the total
 * is what says they exist. It is left out entirely when nothing is hidden,
 * rather than saying so — a permanent "matching filters" would be noise on a
 * list that is showing everything.
 */
function describeCount(found: number, total: number): string {
	if (found === total) {
		return `${found} ${found === 1 ? "hit" : "hits"}`;
	}

	return `${found} of ${total} hits`;
}

/**
 * The header for the hit list. Carries the hit count, the actions that apply to
 * a selection once there is one, and the labels for the columns of figures each
 * hit is summarised by.
 *
 * Shared by both views: they draw the same columns in the same places, and
 * differ only in whether a coverage chart is drawn under each hit.
 */
export default function PathoscopeListHeader({
	checked,
	found,
	onCopy,
	onSelectAll,
	selectedCount,
	showAbbreviation,
	total,
}: PathoscopeListHeaderProps) {
	const { search } = useAnalysisSearch();
	const [copied, setCopied] = useState(false);
	const isSecureContext = useIsSecureContext();

	useEffect(() => {
		if (!copied) {
			return;
		}

		const timeout = setTimeout(() => setCopied(false), 2000);

		return () => clearTimeout(timeout);
	}, [copied]);

	// Only a resolved write flips the label, so a rejected one — a revoked
	// permission, an unfocused document — cannot claim the table was copied.
	function handleCopy() {
		onCopy().then(
			() => setCopied(true),
			(error) =>
				Sentry.captureException(error, {
					tags: { clipboard: "pathoscope-table" },
				}),
		);
	}

	return (
		// A hit's coverage charts are tall enough that the select-all checkbox and
		// the copy action scroll out of reach after two or three of them, so the
		// bar sticks. `top-0` is the top of `#content-scroll` rather than the
		// window: the nav sits outside that container, so nothing overlaps. The
		// z-index stays below the named scale in `style.css` — this only has to
		// beat the hits scrolling under it, not any overlay.
		//
		// The gap under the nav is padding on the sticky box, not `top-2.5`. The
		// page has no background of its own, so an offset would leave the hits
		// visible in the band above the bar as they scrolled past; an opaque
		// white strip that sticks along with the bar covers them instead.
		<div className="sticky top-0 z-1 mb-2.5 bg-white pt-2.5">
			{/* A named group, so the select-all, the count and the copy action are
			    announced as belonging together rather than as loose controls ahead
			    of the list. `min-w-0` because a fieldset will not otherwise shrink
			    below its content, which would push the bar wider than the hits. */}
			<fieldset
				aria-label="Hit list"
				className="min-w-0 flex items-center gap-4 border border-gray-300 rounded-sm bg-gray-50 px-4 h-14 text-sm font-medium text-gray-700"
			>
				<Checkbox
					ariaLabel="Select all hits"
					checked={checked}
					id="PathoscopeSelectAll"
					onClick={onSelectAll}
				/>
				{/* The count stays put once hits are selected. It is the only statement
				    of how long the list is, and the selection is measured against it. */}
				<span className="text-base">
					{selectedCount
						? `${selectedCount} selected · ${describeCount(found, total)}`
						: describeCount(found, total)}
				</span>
				{/* Pushed to the right edge, beside the column labels it precedes: the
				    clipboard API is unavailable outside a secure context. */}
				<div className="ml-auto flex items-center gap-4 shrink-0">
					{selectedCount > 0 && isSecureContext && (
						<Button size="small" onClick={handleCopy}>
							<Icon icon={copied ? Check : ClipboardCopy} />{" "}
							{copied ? "Copied" : "Copy"}
						</Button>
					)}
					{/* The columns of figures are labelled here instead of on every hit.
					    They are the same fixed widths, in the same order, aligned against
					    the same right edge, so each label lands over its column — a hit
					    without an abbreviation leaves that one empty rather than shifting
					    the rest, because the group is aligned from the right.

					    Hidden from assistive technology: every figure still carries its
					    own label, so announcing these too would read each column name
					    once here and again on every hit. */}
					<div
						aria-hidden
						className="flex gap-4 shrink-0 font-medium text-gray-500"
					>
						{showAbbreviation && <span className="w-32">Abbreviation</span>}
						<span className="w-22">{search.reads ? "Reads" : "Weight"}</span>
						<span className="w-22">Depth</span>
						<span className="w-22">Coverage</span>
					</div>
				</div>
			</fieldset>
		</div>
	);
}
