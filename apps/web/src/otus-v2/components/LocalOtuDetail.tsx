import Badge from "@base/Badge";
import Box, { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import SectionHeader from "@base/SectionHeader";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";

/** The detail page for one local v2 OTU, assembled from relational state. */
export default function LocalOtuDetail({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);

	return (
		<div>
			<SectionHeader>
				<h2>
					{otu.taxonomy.name}
					{otu.taxonomy.acronym ? ` (${otu.taxonomy.acronym})` : ""}{" "}
					<Badge color="purple">Beta</Badge>
					<Badge color="gray">Version {otu.version}</Badge>
				</h2>
				<p>
					OTU <span className="font-mono">{otu.id}</span>
				</p>
			</SectionHeader>

			<Box>
				<dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
					<dt className="font-semibold">Molecule</dt>
					<dd>
						{otu.molecule.type}, {otu.molecule.strandedness} stranded,{" "}
						{otu.molecule.topology}
					</dd>
				</dl>
			</Box>

			<BoxGroup>
				<BoxGroupHeader>Plan</BoxGroupHeader>
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

			{otu.isolates.map((isolate) => (
				<BoxGroup key={isolate.id}>
					<BoxGroupHeader>
						{isolate.name
							? `${isolate.name.type} ${isolate.name.value}`
							: "Unnamed isolate"}
					</BoxGroupHeader>
					{isolate.sequences.map((sequence) => (
						<BoxGroupSection key={sequence.id}>
							<div className="font-semibold">{sequence.definition}</div>
							<div className="break-all font-mono text-sm">
								{sequence.sequence}
							</div>
						</BoxGroupSection>
					))}
				</BoxGroup>
			))}

			<Box>
				<h3 className="font-semibold">History</h3>
				<p>
					{otu.mostRecentChange.command} (schema v
					{otu.mostRecentChange.commandSchemaVersion}) created version{" "}
					{otu.mostRecentChange.version} by user {otu.mostRecentChange.userId}.
				</p>
			</Box>
		</div>
	);
}
