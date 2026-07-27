import { Quality } from "@quality/components/Quality";
import { getRouteApi } from "@tanstack/react-router";
import { useSuspenseSample } from "../queries";
import LegacyAlert from "./SampleFilesMessage";

const routeApi = getRouteApi("/_authenticated/samples/$sampleId");

/**
 * Samples quality view showing charts for bases, composition, and sequences
 */
export default function SampleQuality() {
	const { sampleId } = routeApi.useParams();
	const { data } = useSuspenseSample(Number(sampleId));

	return (
		<div className="flex flex-col">
			<LegacyAlert className="mb-5" showLegacy={data.isLegacy} />
			{data.quality && (
				<Quality
					bases={data.quality.bases}
					composition={data.quality.composition}
					sequences={data.quality.sequences}
				/>
			)}
		</div>
	);
}
