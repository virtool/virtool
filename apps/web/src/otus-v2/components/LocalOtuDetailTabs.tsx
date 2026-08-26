import { NavTab, NavTabs } from "@base/Nav";

/** Tabs to navigate the detailed view of one local v2 OTU. */
export default function LocalOtuDetailTabs({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const base = `/refs/beta/${referenceId}/otus/${otuId}`;

	return (
		<NavTabs>
			<NavTab to={base} exclude={[`${base}/isolates`, `${base}/history`]}>
				OTU
			</NavTab>
			<NavTab to={`${base}/isolates`}>Isolates</NavTab>
			<NavTab to={`${base}/history`}>History</NavTab>
		</NavTabs>
	);
}
