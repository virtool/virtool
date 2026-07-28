import { DEFAULT_PER_PAGE } from "@app/pagination";
import Alert from "@base/Alert";
import Link from "@base/Link";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";
import { Info } from "lucide-react";
import { useFindIndexes } from "../queries";

type RebuildAlertProps = {
	page: number;
	referenceId: number;
};

/**
 * An alert that appears when the reference has unbuilt changes.
 */
export default function RebuildAlert({ page, referenceId }: RebuildAlertProps) {
	const { data, isPending, isError } = useFindIndexes(
		referenceId,
		page,
		DEFAULT_PER_PAGE,
	);
	const { hasPermission: hasRights } = useCheckReferenceRight(
		referenceId,
		"build",
	);
	const archived = useReferenceIsArchived(referenceId);

	// Stay silent on error: this is a supplementary alert, and the index list
	// that renders it already surfaces the failure.
	if (isError || isPending || archived) {
		return null;
	}

	const { changeCount } = data;

	if (changeCount && hasRights) {
		return (
			<Alert color="orange" level icon={Info}>
				<span>
					<span>There are unbuilt changes. </span>
					<Link
						to="/refs/$refId/indexes"
						params={{ refId: String(referenceId) }}
					>
						Rebuild the index
					</Link>
					<span> to use the changes in future analyses.</span>
				</span>
			</Alert>
		);
	}

	return null;
}
