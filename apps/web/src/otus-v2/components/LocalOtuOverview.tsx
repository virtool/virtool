import Box, { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import Link from "@base/Link";
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
	const remaining = otu.isolates.length - previewIsolates.length;

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

			<BoxGroup>
				<BoxGroupHeader>Isolates</BoxGroupHeader>
				{previewIsolates.map((isolate) => (
					<BoxGroupSection key={isolate.id}>
						{isolate.name
							? `${isolate.name.type} ${isolate.name.value}`
							: "Unnamed isolate"}
					</BoxGroupSection>
				))}
				{remaining > 0 && (
					<BoxGroupSection>
						<Link
							to="/refs/beta/$referenceId/otus/$otuId/isolates"
							params={{ referenceId, otuId }}
						>
							View {remaining} more {remaining === 1 ? "isolate" : "isolates"}
						</Link>
					</BoxGroupSection>
				)}
			</BoxGroup>
		</>
	);
}
