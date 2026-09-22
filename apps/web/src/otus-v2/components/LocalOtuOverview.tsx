import Badge from "@base/Badge";
import Box, { BoxGroup, BoxGroupSection } from "@base/Box";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@base/Collapsible";
import ExternalLink from "@base/ExternalLink";
import Link from "@base/Link";
import SectionHeader from "@base/SectionHeader";
import EditLocalOtuPlan from "@otus-v2/components/EditLocalOtuPlan";
import EditLocalOtuTaxonomy from "@otus-v2/components/EditLocalOtuTaxonomy";
import LocalOtuAccessionExclusions from "@otus-v2/components/LocalOtuAccessionExclusions";
import { formatV2IsolateName } from "@otus-v2/isolateName";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";

const ISOLATE_PREVIEW_COUNT = 5;

/** The OTU tab of the local v2 OTU detail view, showing molecule and plan. */
export default function LocalOtuOverview({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);

	const previewIsolates = otu.isolates.slice(0, ISOLATE_PREVIEW_COUNT);
	const remaining = otu.isolateCount - previewIsolates.length;
	const speciesIndex = otu.taxonomy.lineage.findIndex(
		(taxon) => taxon.rank === "species",
	);
	const higherTaxa =
		speciesIndex > 0 ? otu.taxonomy.lineage.slice(0, speciesIndex) : [];
	const speciesAndBelow =
		speciesIndex >= 0
			? otu.taxonomy.lineage.slice(speciesIndex)
			: otu.taxonomy.lineage;

	return (
		<>
			<section>
				<SectionHeader className="flex items-center justify-between gap-3">
					<h2>Taxonomy</h2>
					<EditLocalOtuTaxonomy referenceId={referenceId} otu={otu} />
				</SectionHeader>
				<Box>{otu.taxonomy.name}</Box>
			</section>
			<Box>
				<dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
					<dt className="font-semibold">Molecule</dt>
					<dd>
						{otu.molecule.type}, {otu.molecule.strandedness} stranded,{" "}
						{otu.molecule.topology}
					</dd>
				</dl>
			</Box>

			{otu.taxonomy.lineage.length > 0 && (
				<section>
					<SectionHeader>
						<h2>Lineage</h2>
					</SectionHeader>
					<BoxGroup>
						{higherTaxa.length > 0 && (
							<BoxGroupSection className="p-0">
								<Collapsible>
									<CollapsibleTrigger className="px-6 py-3">
										Show higher taxa
									</CollapsibleTrigger>
									<CollapsibleContent>
										{higherTaxa.map((taxon) => (
											<LineageTaxon key={taxon.id} taxon={taxon} />
										))}
									</CollapsibleContent>
								</Collapsible>
							</BoxGroupSection>
						)}
						{speciesAndBelow.map((taxon) => (
							<LineageTaxon key={taxon.id} taxon={taxon} />
						))}
					</BoxGroup>
				</section>
			)}

			<section>
				<SectionHeader className="flex items-center justify-between gap-3">
					<h2>Segments</h2>
					<EditLocalOtuPlan referenceId={referenceId} otu={otu} />
				</SectionHeader>
				<BoxGroup>
					{otu.plan.segments.map((segment) => (
						<BoxGroupSection key={segment.id}>
							<span className="font-semibold">
								{segment.name
									? `${segment.name.prefix} ${segment.name.key}`
									: "Unnamed segment"}
							</span>{" "}
							— {segment.length} nt · {segment.rule}
						</BoxGroupSection>
					))}
				</BoxGroup>
			</section>

			<section>
				<SectionHeader>
					<h2>Excluded accession bases</h2>
				</SectionHeader>
				<Box>
					<LocalOtuAccessionExclusions referenceId={referenceId} otu={otu} />
				</Box>
			</section>
			<section>
				<SectionHeader>
					<h2>Promoted accession bases</h2>
				</SectionHeader>
				<Box>
					{otu.promotedAccessionBases.length === 0 ? (
						<p>No promoted accession bases.</p>
					) : (
						<ul>
							{otu.promotedAccessionBases.map((item) => (
								<li key={item.accessionBase}>
									<span className="font-mono">{item.accessionBase}</span> →{" "}
									<span className="font-mono">{item.promotedToBase}</span>
								</li>
							))}
						</ul>
					)}
				</Box>
			</section>

			<section>
				<SectionHeader>
					<h2 className="flex items-center gap-2">
						Isolates
						<Badge>{otu.isolateCount}</Badge>
					</h2>
				</SectionHeader>
				<BoxGroup>
					{previewIsolates.map((isolate) => (
						<BoxGroupSection key={isolate.id}>
							<Link
								to="/refs/alpha/$referenceId/otus/$otuId/isolates/$isolateId"
								params={{ referenceId, otuId, isolateId: isolate.id }}
							>
								{formatV2IsolateName(isolate.name)}
							</Link>
						</BoxGroupSection>
					))}
					{remaining > 0 && (
						<BoxGroupSection>
							<Link
								to="/refs/alpha/$referenceId/otus/$otuId/isolates"
								params={{ referenceId, otuId }}
							>
								View {remaining} more {remaining === 1 ? "isolate" : "isolates"}
							</Link>
						</BoxGroupSection>
					)}
				</BoxGroup>
			</section>
		</>
	);
}

function LineageTaxon({
	taxon,
}: {
	taxon: { id: number; name: string; rank: string };
}) {
	return (
		<BoxGroupSection>
			<ExternalLink
				className="font-semibold"
				href={`https://www.ncbi.nlm.nih.gov/datasets/taxonomy/${taxon.id}/`}
			>
				{taxon.name}
			</ExternalLink>
			<span className="text-gray-500"> · {taxon.rank}</span>
		</BoxGroupSection>
	);
}
