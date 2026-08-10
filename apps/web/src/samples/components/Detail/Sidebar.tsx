import { useUpdateSample } from "@samples/queries";
import type { Label, LabelNested, SubtractionNested } from "@virtool/contracts";
import DefaultSubtractions from "../Sidebar/DefaultSubtractions";
import SampleLabels from "../Sidebar/SampleLabels";

type SidebarProps = {
	labels: Label[];
	sampleId: number;
	sampleLabels: Array<LabelNested>;
	defaultSubtractions: Array<SubtractionNested>;
};

/**
 * Sidebar for managing labels and subtractions on a sample.
 */
export default function Sidebar({
	labels,
	sampleId,
	sampleLabels,
	defaultSubtractions,
}: SidebarProps) {
	const mutation = useUpdateSample(sampleId);

	return (
		<div className="flex flex-col items-stretch w-80 z-0">
			<SampleLabels
				labels={labels}
				onUpdate={(labels) => {
					mutation.mutate({ update: { labels } });
				}}
				sampleLabels={sampleLabels.map((label) => label.id)}
			/>
			<DefaultSubtractions
				onUpdate={(subtractions) => {
					mutation.mutate({ update: { subtractions } });
				}}
				defaultSubtractions={defaultSubtractions.map(
					(subtraction) => subtraction.id,
				)}
			/>
		</div>
	);
}
