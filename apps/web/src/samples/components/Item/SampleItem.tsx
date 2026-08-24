import Checkbox from "@base/Checkbox";
import Link from "@base/Link";
import RelativeTime from "@base/RelativeTime";
import { TableActionsCell } from "@base/Table";
import UserLabel from "@base/UserLabel";
import { useFetchJob } from "@jobs/queries";
import type { SampleMinimal } from "@virtool/contracts";
import type { MouseEvent } from "react";
import SampleLabel from "../Label/SampleLabel";
import SampleLibraryTypeLabel from "../Label/SampleLibraryTypeLabel";
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
		<tr>
			<td className="w-px">
				<Checkbox
					ariaLabel={`Select ${sample.name}`}
					checked={checked}
					id={`SampleCheckbox${sample.id}`}
					onClick={handleSelect}
				/>
			</td>
			<td className="font-medium">
				<Link to="/samples/$sampleId" params={{ sampleId: String(sample.id) }}>
					{sample.name}
				</Link>
			</td>
			<td>
				<div className="flex flex-wrap gap-1">
					<SampleLibraryTypeLabel libraryType={sample.libraryType} />
					{sample.labels.map((label) => (
						<SampleLabel {...label} key={label.id} size="sm" />
					))}
				</div>
			</td>
			<td>
				{sample.ready && (
					<WorkflowTags id={sample.id} workflows={sample.workflows} />
				)}
			</td>
			<td className="whitespace-nowrap">
				<RelativeTime time={sample.createdAt} />
			</td>
			<td>
				<UserLabel handle={sample.user.handle} />
			</td>
			<TableActionsCell>
				<EndIcon
					ariaLabel={`Quick analyze ${sample.name}`}
					progress={job?.progress ?? 0}
					state={job?.state}
					onClick={onQuickAnalyze}
					ready={sample.ready}
				/>
			</TableActionsCell>
		</tr>
	);
}
