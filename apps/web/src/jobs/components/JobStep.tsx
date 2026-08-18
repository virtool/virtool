import { cn } from "@app/cn";
import { formatDate, formatRoundedDuration, formatTime } from "@app/date";
import Markdown from "@base/Markdown";
import { useHydrated } from "@tanstack/react-router";
import type { JobState, JobStep } from "@virtool/contracts";
import { CircleDashed } from "lucide-react";
import JobStateIcon from "./JobStateIcon";

type JobStepProps = {
	endedAt: number | null;
	state: JobState;
	step: JobStep;
};

/**
 * A condensed job step for use in a list of job steps
 */
export default function JobStepItem({ endedAt, step, state }: JobStepProps) {
	// Both formats read the local timezone, and the server renders in the
	// container's zone rather than the viewer's, so it cannot produce the string
	// the browser will. The value is held back until hydration instead of being
	// reconciled: React does not patch a suppressed text mismatch, so the
	// server's zone would stay on screen for good. The placeholder runs to the
	// same character count as the real value, so nothing moves when it lands.
	const hydrated = useHydrated();
	const elapsed =
		endedAt === null || step.startedAt === null
			? null
			: formatRoundedDuration(
					Math.max(0, endedAt - step.startedAt.getTime()) / 1000,
				);

	return (
		<tr
			className={cn("border-gray-300 not-last:border-b", {
				"text-muted": state === "pending",
			})}
		>
			<td className="px-4 py-3 align-top">
				{state === "pending" ? (
					<CircleDashed className="stroke-current" size={16} />
				) : (
					<JobStateIcon state={state} />
				)}
				<span className="sr-only">{state}</span>
			</td>
			<td className="px-4 py-3 align-top">
				<div className="font-medium">{step.name}</div>
				<div className="min-w-0">
					<Markdown markdown={step.description} />
				</div>
			</td>
			<td className="px-4 py-3 align-top tabular-nums text-sm">
				{step.startedAt && (
					<time
						dateTime={step.startedAt.toISOString()}
						className={cn({ invisible: !hydrated })}
					>
						{hydrated
							? `${formatDate(step.startedAt)} ${formatTime(step.startedAt)}`
							: "0000-00-00 00:00:00"}
					</time>
				)}
			</td>
			<td className="px-4 py-3 align-top tabular-nums text-right text-sm">
				{elapsed}
			</td>
		</tr>
	);
}
