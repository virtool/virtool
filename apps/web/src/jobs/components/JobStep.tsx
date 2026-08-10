import { cn } from "@app/cn";
import { formatDate, formatTime } from "@app/date";
import Badge from "@base/Badge";
import BoxGroupSection from "@base/BoxGroupSection";
import Markdown from "@base/Markdown";
import { useHydrated } from "@tanstack/react-router";
import type { JobState, JobStep } from "@virtool/contracts";
import { Calendar, Clock } from "lucide-react";
import JobStateIcon from "./JobStateIcon";

type JobStepProps = {
	state: JobState;
	step: JobStep;
};

/**
 * A condensed job step for use in a list of job steps
 */
export default function JobStepItem({ step, state }: JobStepProps) {
	// Both formats read the local timezone, and the server renders in the
	// container's zone rather than the viewer's, so it cannot produce the string
	// the browser will. The value is held back until hydration instead of being
	// reconciled: React does not patch a suppressed text mismatch, so the
	// server's zone would stay on screen for good. The placeholder runs to the
	// same character count as the real value, so nothing moves when it lands.
	const hydrated = useHydrated();

	return (
		<BoxGroupSection className="flex gap-2 items-start">
			<div className="items-center flex">
				<JobStateIcon state={state} />
			</div>

			<div className="">
				<h4 className="font-medium text-lg">{step.name}</h4>
				<Markdown markdown={step.description} />

				{step.startedAt && (
					<div className="flex gap-4">
						<Badge className="flex gap-1.5 items-center tabular-nums">
							<Clock size={16} />
							<time
								dateTime={step.startedAt.toISOString()}
								className={cn({ invisible: !hydrated })}
							>
								{hydrated ? formatTime(step.startedAt) : "00:00:00"}
							</time>
						</Badge>
						<Badge className="flex gap-1.5 items-center tabular-nums">
							<Calendar size={16} />
							<time
								dateTime={step.startedAt.toISOString()}
								className={cn({ invisible: !hydrated })}
							>
								{hydrated ? formatDate(step.startedAt) : "0000-00-00"}
							</time>
						</Badge>
					</div>
				)}
			</div>
		</BoxGroupSection>
	);
}
