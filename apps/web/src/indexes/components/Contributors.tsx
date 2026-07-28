import Badge from "@base/Badge";
import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupSection from "@base/BoxGroupSection";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import type { IndexContributor } from "@virtool/contracts";
import { sortBy } from "es-toolkit";
import { Users } from "lucide-react";
import Contributor from "./Contributor";

type ContributorsProps = {
	contributors: IndexContributor[];
};

/**
 * A list of contributors for the index
 */
export default function Contributors({ contributors }: ContributorsProps) {
	const sorted = sortBy(contributors, [(c) => c.id, (c) => c.count]);

	const contributorComponents = sorted.map((contributor) => (
		<Contributor key={contributor.id} {...contributor} />
	));

	if (contributorComponents.length === 0) {
		contributorComponents.push(
			<BoxGroupSection key="noneFound" className="py-10">
				<Empty>
					<EmptyMedia className="text-gray-400">
						<Users size={40} strokeWidth={1.5} />
					</EmptyMedia>
					<EmptyTitle>No contributors found</EmptyTitle>
					<EmptyDescription>
						No one has contributed changes to this reference yet.
					</EmptyDescription>
				</Empty>
			</BoxGroupSection>,
		);
	}

	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2 className="flex gap-2">
					<span>Contributors</span>
					<Badge>{contributors.length}</Badge>
				</h2>
			</BoxGroupHeader>
			{contributorComponents}
		</BoxGroup>
	);
}
