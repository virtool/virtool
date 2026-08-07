import Badge from "@base/Badge";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import ExternalLink from "@base/ExternalLink";
import Label from "@base/Label";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import NotFound from "@base/NotFound";
import ScrollArea from "@base/ScrollArea";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import { getRouteApi } from "@tanstack/react-router";
import { useFetchHmm } from "../queries";
import { HmmEntropyIndicator } from "./HmmEntropyIndicator";
import { HmmTaxonomy } from "./HmmTaxonomy";

const routeApi = getRouteApi("/_authenticated/hmms/$hmmId");

/**
 * The HMM detailed view
 */
export default function HmmDetail() {
	const { hmmId } = routeApi.useParams();
	const { data, isPending, isError } = useFetchHmm(Number(hmmId));

	if (isError) {
		return <NotFound />;
	}

	if (isPending) {
		return <LoadingPlaceholder className="mt-32" />;
	}

	const clusterMembers = data.entries.map(({ name, accession, organism }) => (
		<BoxGroupSection key={accession} className="grid grid-cols-3">
			<ExternalLink href={`http://www.ncbi.nlm.nih.gov/protein/${accession}`}>
				{accession}
			</ExternalLink>
			<span>{name}</span>
			<span>{organism}</span>
		</BoxGroupSection>
	));

	const names = data.names.map((name) => (
		<Label className="mr-1" key={name}>
			{name}
		</Label>
	));

	const title = data.names[0] ?? "";

	return (
		<div>
			<ViewHeader title={title}>
				<ViewHeaderTitle>{title}</ViewHeaderTitle>
			</ViewHeader>

			<BoxGroup>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">Cluster</span>
						<p className="m-0 text-gray-500">
							Unique identifier for this profile
						</p>
					</div>
					<span>{data.cluster}</span>
				</BoxGroupSection>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">Names</span>
						<p className="m-0 text-gray-500">
							Common names derived from cluster members
						</p>
					</div>
					<div>{names}</div>
				</BoxGroupSection>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">Length</span>
						<p className="m-0 text-gray-500">
							Number of consensus positions in the model
						</p>
					</div>
					<span>{data.length}</span>
				</BoxGroupSection>
				<BoxGroupSection className="flex items-center justify-between">
					<div>
						<span className="font-medium">Mean Entropy</span>
						<p className="m-0 text-gray-500">
							Average variability per position. Lower is more conserved.
						</p>
					</div>
					<HmmEntropyIndicator entropy={data.meanEntropy} />
				</BoxGroupSection>
			</BoxGroup>

			<section>
				<header className="mb-4">
					<h3 className="font-medium text-lg flex items-center gap-2">
						Cluster Members
						<Badge>{data.entries.length}</Badge>
					</h3>
					<p className="m-0 text-gray-600">
						Protein sequences included in this cluster.
					</p>
				</header>
				<BoxGroup>
					<div className="grid grid-cols-3 font-medium bg-gray-100 py-2 px-6 border-b border-gray-300">
						<span>Accession</span>
						<span>Name</span>
						<span>Organism</span>
					</div>
					<ScrollArea className="w-full h-72 border-none rounded-none mr-0">
						{clusterMembers}
					</ScrollArea>
				</BoxGroup>
			</section>

			<section>
				<header className="mb-4">
					<h3 className="font-medium text-lg">Taxonomy</h3>
					<p className="m-0 text-gray-600">
						Taxonomic distribution of cluster member organisms.
					</p>
				</header>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<HmmTaxonomy subtitle="Families" counts={data.families} />
					<HmmTaxonomy subtitle="Genera" counts={data.genera} />
				</div>
			</section>
		</div>
	);
}
