import Link from "@base/Link";
import SideBarSection from "@base/SideBarSection";
import SidebarHeader from "@base/SidebarHeader";
import type { Label } from "@virtool/contracts";
import { xor } from "es-toolkit/array";
import SampleLabel from "../Label/SampleLabel";
import SampleSidebarList from "./SampleSidebarList";
import SampleSidebarSelector from "./SampleSidebarSelector";

type SampleLabelsProps = {
	/** All labels available for selection */
	labels: Label[];
	/** List of label ids associated with the sample */
	sampleLabels: number[];
	/** Callback function to handle label selection */
	onUpdate: (labels: number[]) => void;
};

/**
 * Sidebar for managing sample labels. Pure presentation — caller fetches labels.
 */
export default function SampleLabels({
	labels,
	sampleLabels,
	onUpdate,
}: SampleLabelsProps) {
	return (
		<SideBarSection>
			<SidebarHeader>
				<span>Labels</span>
				<SampleSidebarSelector
					render={({ name, color }) => (
						<SampleLabel name={name} color={color} size="sm" />
					)}
					items={labels}
					selectedIds={sampleLabels}
					onUpdate={(labelId: string | number) => {
						onUpdate(xor(sampleLabels, [Number(labelId)]));
					}}
					selectionType="labels"
					manageLink={"/samples/labels"}
				/>
			</SidebarHeader>
			<SampleSidebarList
				items={labels.filter((item) => sampleLabels.includes(item.id))}
			/>
			{Boolean(labels.length) || (
				<div className="flex text-gray-600 [&_a]:ml-1 [&_a]:text-sm [&_a]:font-medium">
					No labels found. <Link to="/samples/labels">Create one</Link>.
				</div>
			)}
		</SideBarSection>
	);
}
