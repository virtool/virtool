import Badge from "@base/Badge";
import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import type { OtuHistory } from "@virtool/contracts";
import { sortBy } from "es-toolkit";
import Change from "./Change";

type HistoryListProps = {
	/** The history of built or unbuilt changes */
	history: OtuHistory[];
	/** Whether the changes are unbuilt */
	unbuilt?: boolean;
};

/**
 * Displays a history list of changes made to the OTU
 */
export default function HistoryList({
	history,
	unbuilt = false,
}: HistoryListProps) {
	const changes = sortBy(history, [(h) => h.otu.version]).reverse();

	const changeComponents = changes.map((change) => (
		<Change
			key={change.id}
			methodName={change.methodName}
			otu={change.otu}
			user={change.user}
			description={change.description}
			createdAt={change.createdAt}
		/>
	));

	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2 className="flex gap-2 items-center">
					<span>{unbuilt ? "Unb" : "B"}uilt Changes</span>
					<Badge>{changes.length}</Badge>
				</h2>
			</BoxGroupHeader>
			{changeComponents}
		</BoxGroup>
	);
}
