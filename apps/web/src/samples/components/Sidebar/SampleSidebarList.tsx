import type { SubtractionOption } from "@subtraction/types";
import type { Label } from "@virtool/contracts";
import SampleLabel from "../Label/SampleLabel";

type SampleSidebarListProps = {
	/** List of labels or subtractions associated with the sample */
	items: Label[] | SubtractionOption[];
};

/**
 * A sidebar to list labels or subtractions associated with a sample
 */
export default function SampleSidebarList({ items }: SampleSidebarListProps) {
	const sampleItemComponents = items.map((item) => (
		<SampleLabel
			className="bg-white inline m-0 mr-1 mb-1"
			key={item.id}
			color={"color" in item ? item.color : undefined}
			name={item.name}
		/>
	));

	return <div className="flex flex-wrap">{sampleItemComponents}</div>;
}
