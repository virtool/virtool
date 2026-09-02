import { formatTime } from "@app/date";
import RelativeTime from "@base/RelativeTime";
import Tooltip from "@base/Tooltip";
import { getOtuV2ChangeDescription } from "@otus-v2/history";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";
import type { OtuV2Change } from "@virtool/contracts";
import { Dna, FlaskConical, type LucideIcon, Trash } from "lucide-react";

function getChangeIcon(change: OtuV2Change): LucideIcon {
	switch (change.command) {
		case "CreateOTU":
			return Dna;
		case "CreateIsolate":
			return FlaskConical;
		case "DeleteIsolate":
			return Trash;
		case "DeleteOTU":
			return Trash;
	}
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
					const ChangeIcon = getChangeIcon(change);
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
							<span className="relative z-10 flex size-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
								<ChangeIcon aria-hidden="true" className="size-4" />
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
