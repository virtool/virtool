import Badge from "@base/Badge";
import { BoxGroup } from "@base/Box";
import SectionHeader from "@base/SectionHeader";
import type { IndexOtu as OTU } from "@virtool/contracts";
import IndexOTU from "./IndexOTU";

type IndexOTUsProps = {
	otus: OTU[];
	refId: string;
};

/**
 * A list of OTUs associated with the index
 */
export default function IndexOTUs({ otus, refId }: IndexOTUsProps) {
	const otuComponents = otus.map((otu) => (
		<IndexOTU
			key={otu.id}
			refId={refId}
			name={otu.name}
			id={otu.id}
			changeCount={otu.changeCount}
		/>
	));

	return (
		<section>
			<SectionHeader>
				<h2 className="flex items-center gap-2">
					OTUs
					<Badge>{otus.length}</Badge>
				</h2>
			</SectionHeader>
			<BoxGroup>{otuComponents}</BoxGroup>
		</section>
	);
}
