import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import Alert from "@base/Alert";
import Box from "@base/Box";
import Button from "@base/Button";
import Icon from "@base/Icon";
import ProgressBarAffixed from "@base/ProgressBarAffixed";
import { useQueryClient } from "@tanstack/react-query";
import { useFetchTask } from "@tasks/queries";
import type { HmmSearchResult } from "@virtool/contracts";
import { Info } from "lucide-react";
import { useEffect } from "react";
import { hmmQueryKeys } from "../keys";
import { useInstallHmm } from "../queries";

type HmmInstallProps = {
	/** The install status of the HMMs, read from the list the parent already fetched */
	status: HmmSearchResult["status"];
};

/**
 * Displays the installation progress information or provides the option to install HMMs
 */
export function HmmInstall({ status }: HmmInstallProps) {
	const queryClient = useQueryClient();
	const { hasPermission: canInstall } =
		useCheckAdminRoleOrPermission("modify_hmm");
	const installMutation = useInstallHmm();

	const seedTask = status.task;
	const { data: task } = useFetchTask(
		seedTask?.id ?? Number.NaN,
		seedTask ?? undefined,
	);

	const taskComplete = task?.complete;

	useEffect(() => {
		if (taskComplete) {
			queryClient.invalidateQueries({ queryKey: hmmQueryKeys.lists() });
		}
	}, [taskComplete, queryClient]);

	const { installed } = status;

	if (task && !installed) {
		const progress = task.progress;
		const step = task.step.replace("_", " ");

		return (
			<Box className="flex justify-center py-9">
				<ProgressBarAffixed color="blue" now={progress} />
				<div>
					<h3 className="text-xl">Installing</h3>
					<p className="text-center capitalize">{step}</p>
				</div>
			</Box>
		);
	}

	return (
		<Box className="flex justify-center py-9">
			<Icon icon={Info} className="text-3xl text-blue-500 mt-0.5 mx-2.5" />
			<div>
				<h3 className="text-xl font-medium mb-0.5">
					HMM profiles not installed.
				</h3>
				<p>
					HMM profiles are required for NuVs analysis. Click below to install
					the official profiles.
				</p>
				{canInstall ? (
					<Button
						className="mt-4"
						color="blue"
						onClick={() => installMutation.mutate()}
					>
						Install
					</Button>
				) : (
					<Alert block className="m-0 mt-4" color="orange">
						Contact an administrator to install HMMs.
					</Alert>
				)}
			</div>
		</Box>
	);
}
