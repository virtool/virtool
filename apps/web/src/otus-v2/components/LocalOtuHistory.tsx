import { formatDate, formatTime } from "@app/date";
import Box from "@base/Box";
import { formatOtuV2Change } from "@otus-v2/history";
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
			{otu.changes.map((change) => (
				<p key={change.version}>
					{formatOtuV2Change(change)} Version {change.version} by{" "}
					{change.user.handle}.{" "}
					<time dateTime={change.createdAt.toISOString()}>
						{formatDate(change.createdAt)} {formatTime(change.createdAt)}
					</time>
				</p>
			))}
		</Box>
	);
}
