import Badge from "@base/Badge";
import { BoxGroupSection } from "@base/Box";
import Link from "@base/Link";

type IndexOTUProps = {
	refId: string;
	/** The quantity of changes made to this otu since last index build */
	changeCount: number;
	id: string;
	name: string;
};

/**
 * A condensed index OTU item for use in a list of index OTUs
 */
export default function IndexOTU({
	refId,
	changeCount,
	id,
	name,
}: IndexOTUProps) {
	return (
		<BoxGroupSection className="flex justify-between">
			<Link to="/refs/$refId/otus/$otuId" params={{ refId, otuId: id }}>
				{name}
			</Link>
			<Badge>
				{changeCount} {`change${changeCount > 1 ? "s" : ""}`}
			</Badge>
		</BoxGroupSection>
	);
}
