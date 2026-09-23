import { formatTime } from "@app/date";
import Icon from "@base/Icon";
import RelativeTime from "@base/RelativeTime";
import Tooltip from "@base/Tooltip";
import type { IconColor } from "@base/types";
import { getOtuV2ChangeDescription } from "@otus-v2/history";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";
import type { OtuV2Change } from "@virtool/contracts";
import { FlaskConical, GitBranch, type LucideIcon, Pencil } from "lucide-react";

type ChangeStyle = {
	color: IconColor;
	icon: LucideIcon;
};

const changeStyles: Record<OtuV2Change["command"], ChangeStyle> = {
	CreateOTU: { icon: GitBranch, color: "blue" },
	CreateIsolate: { icon: FlaskConical, color: "blue" },
	UpdateTaxonomy: { icon: Pencil, color: "blue" },
	UpdatePlan: { icon: Pencil, color: "blue" },
	UpdateIsolate: { icon: Pencil, color: "blue" },
	UpdateSequence: { icon: Pencil, color: "blue" },
	PromoteIsolate: { icon: Pencil, color: "blue" },
	ExcludeAccession: { icon: Pencil, color: "red" },
	AllowAccession: { icon: Pencil, color: "blue" },
	DeleteIsolate: { icon: FlaskConical, color: "red" },
	DeleteOTU: { icon: GitBranch, color: "red" },
};

function getChangeStyle(change: OtuV2Change): ChangeStyle {
	return changeStyles[change.command];
}

function formatExactTime(date: Date): string {
	return `${date.toLocaleDateString("en-CA", {
		day: "numeric",
		month: "long",
		year: "numeric",
	})} at ${formatTime(date)}`;
}

/** The History tab of the local v2 OTU detail view. */
export default function LocalOtuHistory({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);
	const changes = otu.changes.toSorted((a, b) => b.version - a.version);

	return (
		<div className="py-4">
			<ol aria-label="OTU change history">
				{changes.map((change, index) => {
					const { color, icon } = getChangeStyle(change);
					const description = getOtuV2ChangeDescription(change);
					const exactTime = formatExactTime(change.createdAt);

					return (
						<li
							className="relative grid grid-cols-[2rem_1fr] gap-3 pb-6 last:pb-0"
							key={change.version}
						>
							{index < changes.length - 1 && (
								<span
									aria-hidden="true"
									className="absolute bottom-0 left-[0.9375rem] top-8 w-px bg-gray-200"
								/>
							)}
							<span className="relative z-10 flex size-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
								<Icon
									icon={icon}
									color={color}
									aria-hidden="true"
									className="size-4"
								/>
							</span>
							<div className="min-w-0 pt-1">
								<p className="leading-6">
									<span className="font-medium">{change.user.handle}</span>{" "}
									{description.action}
									{description.subject && (
										<>
											{" "}
											<span className="font-medium">{description.subject}</span>
										</>
									)}
								</p>
								{change.acknowledgedMissingRecommendedSegments &&
									change.acknowledgedMissingRecommendedSegments.length > 0 && (
										<p className="mt-1 text-sm">
											Acknowledged missing recommended segments:{" "}
											{change.acknowledgedMissingRecommendedSegments
												.map((item) => `${item.isolateId} / ${item.segmentId}`)
												.join(", ")}
										</p>
									)}
								<p className="mt-0.5 text-sm text-gray-500">
									<Tooltip tip={exactTime}>
										<button
											className="transition-colors hover:text-blue-600 focus-visible:text-blue-600 focus-visible:outline-none"
											type="button"
										>
											<RelativeTime time={change.createdAt} />
										</button>
									</Tooltip>{" "}
									· Version {change.version}
								</p>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
