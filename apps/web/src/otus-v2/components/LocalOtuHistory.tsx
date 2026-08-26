import Box from "@base/Box";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";

/** The History tab of the local v2 OTU detail view. */
export default function LocalOtuHistory({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);

	return (
		<Box>
			<h3 className="font-semibold">History</h3>
			<p>
				{otu.mostRecentChange.command} (schema v
				{otu.mostRecentChange.commandSchemaVersion}) created version{" "}
				{otu.mostRecentChange.version} by {otu.mostRecentChange.user.handle}.
			</p>
		</Box>
	);
}
