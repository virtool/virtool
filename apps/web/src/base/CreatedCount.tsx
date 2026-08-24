import { cn } from "@app/cn";
import { pluralize } from "@app/format";
import { useTimedReset } from "@app/hooks";
import FadeOut from "./FadeOut";

type CreatedCountProps = {
	className?: string;

	/** How many records the form has created since the tally last cleared. */
	count: number;

	/** Clears `count` once the tally has been on screen long enough. */
	onExpire: () => void;

	/** The plural noun, for irregular nouns like "analyses". */
	plural?: string;

	/** The singular noun for the created record. */
	singular: string;
};

/**
 * A running tally of the records a "create more" form has created, which fades
 * out once it has been on screen long enough. Creating again before it expires
 * bumps the count and restarts the hold.
 */
export default function CreatedCount({
	className,
	count,
	onExpire,
	plural,
	singular,
}: CreatedCountProps) {
	useTimedReset(count, onExpire);

	return (
		<FadeOut className={cn("text-gray-600", className)} role="status">
			{count > 0 ? `${pluralize(count, singular, plural)} created` : null}
		</FadeOut>
	);
}
