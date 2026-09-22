import { formatV2IsolateName } from "@otus-v2/isolateName";
import type { OtuV2Isolate } from "@virtool/contracts";

/** One missing recommended segment shown in a curation preview. */
export type MissingRecommendedItem = {
	isolateId: string;
	isolateName: OtuV2Isolate["name"];
	segmentId: string;
	segmentName: string;
};

/** Show the exact omissions that a curator must acknowledge. */
export default function MissingRecommendedAcknowledgement({
	items,
	checked,
	onChange,
}: {
	items: MissingRecommendedItem[];
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	if (items.length === 0) {
		return null;
	}
	return (
		<div className="my-3 rounded border border-amber-300 bg-amber-50 p-3">
			<p className="font-semibold">Missing recommended segments</p>
			<ul>
				{items.map((item) => (
					<li key={`${item.isolateId}:${item.segmentId}`}>
						{formatV2IsolateName(item.isolateName)}: {item.segmentName}
					</li>
				))}
			</ul>
			<label>
				<input
					type="checkbox"
					checked={checked}
					onChange={(event) => onChange(event.target.checked)}
				/>{" "}
				I acknowledge these recommended segments are missing
			</label>
		</div>
	);
}
