import BoxGroupSection from "@base/BoxGroupSection";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import Link from "@base/Link";
import RelativeTime from "@base/RelativeTime";
import type { ReferenceBuild } from "@virtool/contracts";
import { Boxes } from "lucide-react";

type LatestBuildProps = {
	id: string;
	/** Information related to the latest index build */
	latestBuild: ReferenceBuild | null;
};

/**
 * Displays the latest index build information associated with the reference
 */
export function LatestBuild({ id, latestBuild }: LatestBuildProps) {
	if (latestBuild) {
		return (
			<BoxGroupSection className="flex items-center">
				<div>
					<strong>
						<Link
							to="/refs/$refId/indexes/$indexId"
							params={{ refId: id, indexId: String(latestBuild.id) }}
						>
							Index {latestBuild.version}
						</Link>
					</strong>
					<span>
						&nbsp;/ Created <RelativeTime time={latestBuild.createdAt} /> by{" "}
						{latestBuild.user.handle}
					</span>
				</div>
			</BoxGroupSection>
		);
	}

	return (
		<BoxGroupSection className="py-10">
			<Empty>
				<EmptyMedia className="text-gray-400">
					<Boxes size={40} strokeWidth={1.5} />
				</EmptyMedia>
				<EmptyTitle>No index builds found</EmptyTitle>
				<EmptyDescription>
					This reference has no built indexes yet.
				</EmptyDescription>
			</Empty>
		</BoxGroupSection>
	);
}
