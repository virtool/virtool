import Attribution from "@base/Attribution";
import Box from "@base/Box";
import Checkbox from "@base/Checkbox";
import Link from "@base/Link";
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
 * A condensed sample item for use in a list of samples
 */
export default function SampleItem({
	sample,
	checked,
	handleSelect,
	onQuickAnalyze,
}: SampleItemProps) {
	const { data: job } = useFetchJob(sample.job?.id ?? Number.NaN, sample.job);

	return (
		<Box
			as="li"
			className="grid grid-cols-sample items-center gap-x-4 gap-y-2.5 border-0 mb-0 py-2.5 rounded-none"
		>
			<Checkbox
				ariaLabel={`Select ${sample.name}`}
				checked={checked}
				id={`SampleCheckbox${sample.id}`}
				onClick={handleSelect}
			/>
			<Link
				className="text-lg font-medium overflow-hidden text-ellipsis whitespace-nowrap"
				to="/samples/$sampleId"
				params={{ sampleId: String(sample.id) }}
			>
				{sample.name}
			</Link>
			<Attribution time={sample.createdAt} user={sample.user.handle} />
			<div className="flex justify-end items-center gap-2">
				{sample.ready && (
					<WorkflowTags id={sample.id} workflows={sample.workflows} />
				)}
				<EndIcon
					ariaLabel={`Quick analyze ${sample.name}`}
					progress={job?.progress ?? 0}
					state={job?.state}
					onClick={onQuickAnalyze}
					ready={sample.ready}
				/>
			</div>
			<div className="col-start-2 col-span-3 flex gap-1">
				<SampleLibraryTypeLabel libraryType={sample.libraryType} />
				{sample.labels.map((label) => (
					<SampleLabel {...label} key={label.id} size="sm" />
				))}
			</div>
		</Box>
	);
}
