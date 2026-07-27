import ContainerNarrow from "@base/ContainerNarrow";
import SampleFileSizeWarning from "@samples/components/Detail/SampleFileSizeWarning";
import { useSuspenseSample } from "@samples/queries";
import { getRouteApi } from "@tanstack/react-router";
import SampleFilesMessage from "../SampleFilesMessage";
import SampleReads from "./SampleReads";

const routeApi = getRouteApi("/_authenticated/samples/$sampleId");

/**
 * The uploads view in sample details
 */
export default function SampleDetailFiles() {
	const { sampleId } = routeApi.useParams();
	const { data } = useSuspenseSample(Number(sampleId));

	return (
		<ContainerNarrow>
			<SampleFileSizeWarning reads={data.reads} sampleId={data.id} />
			<SampleFilesMessage showLegacy={data.isLegacy} />
			<SampleReads reads={data.reads} sampleName={data.name} />
		</ContainerNarrow>
	);
}
