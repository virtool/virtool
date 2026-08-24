import Badge from "@base/Badge";
import { NavTab, NavTabs } from "@base/Nav";

type ReferenceDetailTabsProps = {
	id: string;
	otuCount: number;
};

/**
 * Displays tabs to navigate through the detailed view of a reference
 */
export default function ReferenceDetailTabs({
	id,
	otuCount,
}: ReferenceDetailTabsProps) {
	return (
		<NavTabs>
			<NavTab to={`/refs/${id}/manage`}>Manage</NavTab>
			<NavTab to={`/refs/${id}/otus`}>
				OTUs <Badge>{otuCount}</Badge>
			</NavTab>
			<NavTab to={`/refs/${id}/indexes`}>Indexes</NavTab>
			<NavTab to={`/refs/${id}/settings`}>Settings</NavTab>
		</NavTabs>
	);
}
