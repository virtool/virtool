import { cn } from "@app/cn";
import { capitalize } from "es-toolkit";
import InitialIcon from "./InitialIcon";
import RelativeTime from "./RelativeTime";

type AttributionProps = {
	className?: string;

	/**
	 * When the action happened, or null if the row does not record it.
	 *
	 * The timestamp columns behind these are nullable in Postgres, so absence is
	 * a real state rather than a bug — a row migrated from before the column
	 * existed has no time to show. It renders as the attribution without the
	 * trailing relative time, never as an epoch date pretending to be one.
	 */
	time: Date | null;

	user?: string;
	verb?: string;
};

export default function Attribution({
	className = "",
	time,
	user,
	verb = "created",
}: AttributionProps) {
	return (
		<span className={cn(className, "inline-flex", "items-center gap-2")}>
			{user ? <InitialIcon size="md" handle={user} /> : null}
			<span>
				{user} {user ? verb : capitalize(verb)}
				{time === null ? null : (
					<>
						{" "}
						<RelativeTime time={time} />
					</>
				)}
			</span>
		</span>
	);
}
