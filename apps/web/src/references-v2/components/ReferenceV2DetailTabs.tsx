import { NavTab, NavTabs } from "@base/Nav";

/** Tabs to navigate the detailed view of a local v2 Reference. */
export default function ReferenceV2DetailTabs({
	referenceId,
}: {
	referenceId: string;
}) {
	return (
		<NavTabs>
			<NavTab to={`/refs/alpha/${referenceId}/general`}>General</NavTab>
			<NavTab to={`/refs/alpha/${referenceId}/otus`}>OTUs</NavTab>
		</NavTabs>
	);
}
