import { NavTab, NavTabs } from "@base/Nav";

/** Tabs to navigate the detailed view of a local v2 Reference. */
export default function ReferenceV2DetailTabs({
	referenceId,
}: {
	referenceId: string;
}) {
	return (
		<NavTabs>
			<NavTab to={`/refs/beta/${referenceId}/general`}>General</NavTab>
			<NavTab to={`/refs/beta/${referenceId}/otus`}>OTUs</NavTab>
		</NavTabs>
	);
}
