import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import Attribution from "@base/Attribution";
import Badge from "@base/Badge";
import BoxGroupSection from "@base/BoxGroupSection";
import IconButton from "@base/IconButton";
import Link from "@base/Link";
import ProgressCircle from "@base/ProgressCircle";
import { useFetchTask } from "@tasks/queries";
import type { ReferenceMinimal } from "@virtool/contracts";
import { Copy } from "lucide-react";
import type { ReactNode } from "react";

type ReferenceItemProps = {
	onClone: (id: string) => void;
	reference: ReferenceMinimal;
};

/**
 * A condensed reference item for use in a list of references
 */
export function ReferenceItem({ onClone, reference }: ReferenceItemProps) {
	const { archived, createdAt, id, name, task, user } = reference;

	const { data: liveTask } = useFetchTask(
		task?.id ?? Number.NaN,
		task ?? undefined,
	);
	const activeTask = liveTask ?? task;

	const { hasPermission: canCreate } =
		useCheckAdminRoleOrPermission("create_ref");

	let end: ReactNode = null;

	if (activeTask && !activeTask.complete) {
		end = (
			<span className="flex size-10 items-center justify-center">
				<ProgressCircle
					progress={activeTask.progress || 0}
					state={activeTask.complete ? "succeeded" : "running"}
				/>
			</span>
		);
	} else if (archived) {
		end = (
			<Badge color="gray" variant="soft">
				Archived
			</Badge>
		);
	} else if (canCreate) {
		end = (
			<IconButton
				IconComponent={Copy}
				tip="clone"
				color="blue"
				onClick={() => onClone(String(id))}
			/>
		);
	}

	return (
		<BoxGroupSection as="li" className="grid grid-cols-3 items-center gap-x-4">
			<Link
				className="font-medium text-lg"
				to="/refs/$refId"
				params={{ refId: String(id) }}
			>
				{name}
			</Link>
			<Attribution time={createdAt} user={user?.handle} />
			<div className="flex h-10 items-center justify-end">{end}</div>
		</BoxGroupSection>
	);
}
