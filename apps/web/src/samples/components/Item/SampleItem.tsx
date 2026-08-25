// biome-ignore-all lint/a11y/useFocusableInteractive: ARIA table rows and cells do not require independent focus.
// biome-ignore-all lint/a11y/useSemanticElements: Grid layout requires div elements with explicit table roles.
import Checkbox from "@base/Checkbox";
import Link from "@base/Link";
import RelativeTime from "@base/RelativeTime";
import UserLabel from "@base/UserLabel";
import { useFetchJob } from "@jobs/queries";
import { getLibraryTypeDisplayName } from "@samples/utils";
import type { SampleMinimal } from "@virtool/contracts";
import type { MouseEvent } from "react";
import SampleLabel from "../Label/SampleLabel";
import WorkflowTags from "../Tag/WorkflowTags";
import EndIcon from "./EndIcon";

type SampleItemProps = {
	/** Minimal sample data */
	sample: SampleMinimal;

	/** Whether the sample is selected */
	checked: boolean;

	/** Callback to handle sample selection, receiving the checkbox click event */
	handleSelect: (event: MouseEvent<HTMLButtonElement>) => void;

	/** Callback to open a quick analysis scoped to this sample */
	onQuickAnalyze: () => void;
};

/**
 * One sample in the table of samples.
 */
export default function SampleItem({
	sample,
	checked,
	handleSelect,
	onQuickAnalyze,
}: SampleItemProps) {
	const { data: job } = useFetchJob(sample.job?.id ?? Number.NaN, sample.job);

	return (
		<div className="border-gray-200 border-t" role="rowgroup">
			<div className="sample-table-grid items-center" role="row">
				<div className="px-4 py-2" role="cell">
					<Checkbox
						ariaLabel={`Select ${sample.name}`}
						checked={checked}
						id={`SampleCheckbox${sample.id}`}
						onClick={handleSelect}
					/>
				</div>
				<div className="min-w-0 px-4 py-2" role="cell">
					<Link
						className="text-lg font-medium"
						to="/samples/$sampleId"
						params={{ sampleId: String(sample.id) }}
					>
						{sample.name}
					</Link>
				</div>
				<div className="hidden px-4 py-2 2xl:block" role="cell">
					{getLibraryTypeDisplayName(sample.libraryType)}
				</div>
				<div className="min-w-0 px-4 py-2" role="cell">
					{sample.ready && (
						<WorkflowTags id={sample.id} workflows={sample.workflows} />
					)}
				</div>
				<div className="whitespace-nowrap px-4 py-2" role="cell">
					<RelativeTime time={sample.createdAt} />
				</div>
				<div className="min-w-0 px-4 py-2" role="cell">
					<UserLabel handle={sample.user.handle} />
				</div>
				<div className="flex items-center justify-end px-4 py-2" role="cell">
					<EndIcon
						ariaLabel={`Quick analyze ${sample.name}`}
						progress={job?.progress ?? 0}
						state={job?.state}
						onClick={onQuickAnalyze}
						ready={sample.ready}
					/>
				</div>
			</div>
			{sample.labels.length > 0 && (
				<div className="sample-table-grid pb-2" role="row">
					<div
						aria-colindex={2}
						aria-label="Labels"
						className="col-start-2 col-end-3 flex flex-wrap gap-1 px-4"
						role="cell"
					>
						{sample.labels.map((label) => (
							<SampleLabel {...label} key={label.id} size="sm" />
						))}
					</div>
				</div>
			)}
		</div>
	);
}
