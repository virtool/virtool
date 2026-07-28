import Attribution from "@base/Attribution";
import BoxGroupSection from "@base/BoxGroupSection";
import Link from "@base/Link";
import type { IndexMinimal } from "@virtool/contracts";
import { IndexItemDescription } from "./IndexItemDescription";
import { IndexItemIcon } from "./IndexItemIcon";

type IndexItemProps = {
	activeId?: number;
	index: IndexMinimal;
	refId: string;
};

/**
 * A single index item in the list of indexes.
 *
 * @param activeId - The id of the active index
 * @param index - The index
 * @param refId - The id of the parent reference
 * @return The index item
 */

export function IndexItem({ activeId, index, refId }: IndexItemProps) {
	return (
		<BoxGroupSection as="li">
			<h3 className="grid grid-cols-3 mb-2 text-lg">
				<Link
					className="font-medium"
					to="/refs/$refId/indexes/$indexId"
					params={{ refId, indexId: String(index.id) }}
				>
					Version {index.version}
				</Link>
				<IndexItemDescription
					changeCount={index.changeCount}
					modifiedCount={index.modifiedOtuCount}
				/>
				<IndexItemIcon activeId={activeId} id={index.id} ready={index.ready} />
			</h3>
			<Attribution time={index.createdAt} user={index.user.handle} />
		</BoxGroupSection>
	);
}
