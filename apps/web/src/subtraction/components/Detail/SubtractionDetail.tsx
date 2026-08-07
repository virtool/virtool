import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import { toGcContent } from "@app/format";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import NotFound from "@base/NotFound";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderIcons from "@base/ViewHeaderIcons";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import { useFetchSubtraction } from "@subtraction/queries";
import { getSubtractionFastaName } from "@subtraction/utils";
import type { NucleotideComposition } from "@virtool/contracts";
import { SubtractionAttribution } from "../Attribution";
import DeleteSubtraction from "./DeleteSubtraction";
import EditSubtraction from "./EditSubtraction";

function calculateGc(nucleotides: NucleotideComposition) {
	return toGcContent(1 - nucleotides.a - nucleotides.t - nucleotides.n);
}

/**
 * The subtraction detailed view
 */
import { getRouteApi } from "@tanstack/react-router";

const routeApi = getRouteApi("/_authenticated/subtractions/$subtractionId");

export default function SubtractionDetail() {
	const { subtractionId } = routeApi.useParams();

	const { data, isPending, isError } = useFetchSubtraction(
		Number(subtractionId),
	);
	const { hasPermission: canModify } =
		useCheckAdminRoleOrPermission("modify_subtraction");

	if (isError) {
		return <NotFound />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	if (!data.ready || !data.gc) {
		return <LoadingPlaceholder message="Subtraction is still being imported" />;
	}

	const fastaFile = data.files.find((file) => file.type === "fasta");
	const fastaName = getSubtractionFastaName(data.name);

	return (
		<>
			<ViewHeader title={data.name}>
				<ViewHeaderTitle>
					{data.name}
					{canModify && (
						<ViewHeaderIcons>
							<EditSubtraction subtraction={data} />
							<DeleteSubtraction subtraction={data} />
						</ViewHeaderIcons>
					)}
				</ViewHeaderTitle>
				{data.user ? (
					<SubtractionAttribution
						handle={data.user.handle}
						time={data.createdAt}
					/>
				) : null}
			</ViewHeader>
			<BoxGroup>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">Nickname</span>
						<p className="m-0 text-gray-500">
							Alternative name for this subtraction
						</p>
					</div>
					<span>{data.nickname}</span>
				</BoxGroupSection>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">File</span>
						<p className="m-0 text-gray-500">
							Download the subtraction's FASTA file
						</p>
					</div>
					{fastaFile ? (
						<a
							className="font-medium"
							download={fastaName}
							href={fastaFile.downloadUrl}
						>
							{fastaName}
						</a>
					) : (
						<span>None</span>
					)}
				</BoxGroupSection>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">Sequence Count</span>
						<p className="m-0 text-gray-500">
							Number of sequences in the subtraction
						</p>
					</div>
					<span>{data.count}</span>
				</BoxGroupSection>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">GC Estimate</span>
						<p className="m-0 text-gray-500">
							Estimated GC content of the subtraction genome
						</p>
					</div>
					<span>{calculateGc(data.gc)}</span>
				</BoxGroupSection>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">Linked Samples</span>
						<p className="m-0 text-gray-500">
							Samples that reference this subtraction
						</p>
					</div>
					<span>{data.linkedSamples.length}</span>
				</BoxGroupSection>
			</BoxGroup>
		</>
	);
}
