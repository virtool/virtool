import Alert from "@base/Alert";
import Link from "@base/Link";
import type { HmmStatus } from "@virtool/contracts";
import { CircleAlert } from "lucide-react";

type AnalysisHmmAlertProps = {
	status: HmmStatus;
};

/** Banner informing the user when HMMs are not installed */
export default function AnalysisHmmAlert({ status }: AnalysisHmmAlertProps) {
	if (status.installed?.ready ?? status.task?.complete) {
		return null;
	}

	return (
		<Alert color="orange">
			<div className="flex gap-2 items-center">
				<CircleAlert size={18} />
				<span>
					<strong>HMM data is not installed. </strong>
					<Link to="/hmms">Install HMMs</Link>
					<span> to run Nuvs analyses.</span>
				</span>
			</div>
		</Alert>
	);
}
