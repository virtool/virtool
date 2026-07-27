import { toGcContent } from "@app/format";
import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupTable from "@base/BoxGroupTable";
import ContainerNarrow from "@base/ContainerNarrow";
import ContainerSide from "@base/ContainerSide";
import JobItem from "@jobs/components/JobItem";
import { useFetchJob } from "@jobs/queries";
import type { Label } from "@labels/types";
import { useSuspenseSample } from "@samples/queries";
import { getLibraryTypeDisplayName, toServerJobNested } from "@samples/utils";
/**
 * The general view in sample details
 */
import { getRouteApi } from "@tanstack/react-router";
import SampleFileSizeWarning from "./SampleFileSizeWarning";
import SampleNotes from "./SampleNotes";
import Sidebar from "./Sidebar";

const routeApi = getRouteApi("/_authenticated/samples/$sampleId");

const readCountFormatter = new Intl.NumberFormat("en-US", {
	notation: "compact",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

type SampleDetailGeneralProps = {
	labels: Label[];
};

export default function SampleDetailGeneral({
	labels,
}: SampleDetailGeneralProps) {
	const sampleId = Number(routeApi.useParams().sampleId);
	const { data } = useSuspenseSample(sampleId);
	const { data: job } = useFetchJob(
		data.job?.id ?? Number.NaN,
		data.job && toServerJobNested(data.job),
	);

	const { quality } = data;

	return (
		<div className="flex items-stretch">
			<ContainerNarrow>
				{!data.ready && data.job && (
					<BoxGroup>
						<JobItem
							id={data.job.id}
							workflow={job?.workflow}
							state={job?.state}
							progress={job?.progress}
							createdAt={job?.createdAt}
							user={data.user}
						/>
					</BoxGroup>
				)}
				<SampleFileSizeWarning sampleId={sampleId} reads={data.reads} />
				<BoxGroup>
					<BoxGroupHeader>
						<h2>Metadata</h2>
						<p>User-defined information about the sample.</p>
					</BoxGroupHeader>
					<BoxGroupTable>
						<caption className="sr-only">Sample metadata</caption>
						<tbody>
							<tr>
								<th scope="row">Host</th>
								<td>{data.host}</td>
							</tr>
							<tr>
								<th scope="row">Isolate</th>
								<td>{data.isolate}</td>
							</tr>
							<tr>
								<th scope="row">Locale</th>
								<td>{data.locale}</td>
							</tr>
						</tbody>
					</BoxGroupTable>
				</BoxGroup>

				{data.ready && quality && (
					<BoxGroup>
						<BoxGroupHeader>
							<h2>Library</h2>
							<p>Information about the sequencing reads in this sample.</p>
						</BoxGroupHeader>
						<BoxGroupTable>
							<caption className="sr-only">Sample library</caption>
							<tbody>
								<tr>
									<th scope="row">Encoding</th>
									<td>{quality.encoding}</td>
								</tr>
								<tr>
									<th scope="row">Read Count</th>
									<td>{readCountFormatter.format(quality.count)}</td>
								</tr>
								<tr>
									<th scope="row">Library Type</th>
									<td>{getLibraryTypeDisplayName(data.libraryType)}</td>
								</tr>
								<tr>
									<th scope="row">Length Range</th>
									<td>{quality.length.join(" - ")}</td>
								</tr>
								<tr>
									<th scope="row">GC Content</th>
									<td>{toGcContent(quality.gc / 100)}</td>
								</tr>
								<tr>
									<th scope="row">Paired</th>
									<td>{data.paired ? "Yes" : "No"}</td>
								</tr>
							</tbody>
						</BoxGroupTable>
					</BoxGroup>
				)}

				{data.ready && (
					<BoxGroup>
						<BoxGroupHeader>
							<h2>Notes</h2>
							<p>Additional notes about the sample.</p>
						</BoxGroupHeader>
						<SampleNotes notes={data.notes} />
					</BoxGroup>
				)}
			</ContainerNarrow>

			<ContainerSide className="pl-4">
				<Sidebar
					labels={labels}
					sampleId={data.id}
					sampleLabels={data.labels}
					defaultSubtractions={data.subtractions}
				/>
			</ContainerSide>
		</div>
	);
}
