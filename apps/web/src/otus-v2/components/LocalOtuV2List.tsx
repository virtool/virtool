import Badge from "@base/Badge";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Link from "@base/Link";
import ListEmpty from "@base/ListEmpty";
import { useSuspenseLocalOtusV2 } from "@otus-v2/queries";
import { Dna } from "lucide-react";

/** A list of the local v2 OTUs in a Reference. */
export default function LocalOtuV2List({
	referenceId,
}: {
	referenceId: string;
}) {
	const { data: otus } = useSuspenseLocalOtusV2(referenceId);

	if (otus.length === 0) {
		return (
			<ListEmpty
				icon={Dna}
				title="No OTUs found"
				description="No OTUs have been created in this reference yet."
			/>
		);
	}

	return (
		<BoxGroup as="ul">
			{otus.map((otu) => (
				<BoxGroupSection
					as="li"
					className="grid grid-cols-[1fr_auto] items-center gap-4"
					key={otu.id}
				>
					<div>
						<Link
							className="font-medium text-lg"
							to="/refs/beta/$referenceId/otus/$otuId"
							params={{ referenceId, otuId: otu.id }}
						>
							{otu.name}
							{otu.acronym ? ` (${otu.acronym})` : ""}
						</Link>
						<p className="text-gray-500">
							{otu.isolateCount}{" "}
							{otu.isolateCount === 1 ? "isolate" : "isolates"}
						</p>
					</div>
					<Badge color="gray">Version {otu.version}</Badge>
				</BoxGroupSection>
			))}
		</BoxGroup>
	);
}
