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
				<SectionHeader>
					<h2>Segments</h2>
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
