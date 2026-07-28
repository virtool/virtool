import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupSection from "@base/BoxGroupSection";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import type { UnbuiltChangesSearchResult } from "@virtool/contracts";
import { sortBy } from "es-toolkit";
import type { ReactNode } from "react";

type RebuildHistoryEllipsisProps = {
	unbuilt: UnbuiltChangesSearchResult;
};

type RebuildHistoryItemProps = {
	description: string;
	otuName: string;
};

type RebuildHistoryProps = {
	unbuilt: UnbuiltChangesSearchResult | null;
};

function RebuildHistoryEllipsis({ unbuilt }: RebuildHistoryEllipsisProps) {
	if (unbuilt.pageCount > 1) {
		return (
			<BoxGroupSection className="text-right" key="last-item">
				+ {unbuilt.foundCount - unbuilt.perPage} more changes
			</BoxGroupSection>
		);
	}
}

function RebuildHistoryItem({ description, otuName }: RebuildHistoryItemProps) {
	return (
		<BoxGroupSection className="grid grid-cols-2">
			<strong>{otuName}</strong>

			{description || "No Description"}
		</BoxGroupSection>
	);
}

export default function RebuildHistory({ unbuilt }: RebuildHistoryProps) {
	let content: ReactNode;

	if (unbuilt === null) {
		content = <LoadingPlaceholder className="mt-5" />;
	} else {
		const historyComponents = sortBy(unbuilt.items ?? [], [
			(change) => change.otu.name,
		]).map((change) => (
			<RebuildHistoryItem
				key={change.id}
				description={change.description}
				otuName={change.otu.name}
			/>
		));

		content = (
			<div className="max-h-192 overflow-y-auto">
				{historyComponents}
				<RebuildHistoryEllipsis unbuilt={unbuilt} />
			</div>
		);
	}

	return (
		<BoxGroup>
			<BoxGroupHeader>Changes</BoxGroupHeader>
			{content}
		</BoxGroup>
	);
}
