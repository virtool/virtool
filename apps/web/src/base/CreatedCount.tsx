import { cn } from "@app/cn";
import { pluralize } from "@app/format";
import { useEffect, useRef, useState } from "react";

/** How long the tally holds at full opacity before it starts fading. */
const HOLD_DURATION = 5000;

/** Matches the `duration-300` opacity transition below. */
const FADE_DURATION = 300;

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
 *
 * The element stays mounted while the count is zero so the live region exists
 * before the first message lands; a region added and filled in the same commit
 * is missed by some screen readers. The message outlives the count so the fade
 * has something to act on, and is dropped afterwards so the row reflows.
 */
export default function CreatedCount({
	className,
	count,
	onExpire,
	plural,
	singular,
}: CreatedCountProps) {
	const [message, setMessage] = useState("");
	const onExpireRef = useRef(onExpire);

	useEffect(() => {
		onExpireRef.current = onExpire;
	});

	useEffect(() => {
		if (count === 0) {
			return;
		}

		setMessage(`${pluralize(count, singular, plural)} created`);

		const timeout = setTimeout(() => onExpireRef.current(), HOLD_DURATION);

		return () => clearTimeout(timeout);
	}, [count, plural, singular]);

	// Clocked rather than driven by `transitionend`, which never fires when the
	// user has asked for reduced motion.
	useEffect(() => {
		if (count > 0 || message === "") {
			return;
		}

		const timeout = setTimeout(() => setMessage(""), FADE_DURATION);

		return () => clearTimeout(timeout);
	}, [count, message]);

	return (
		<p
			className={cn(
				"m-0 text-gray-600 transition-opacity duration-300",
				count === 0 ? "opacity-0" : "opacity-100",
				className,
			)}
			role="status"
		>
			{message}
		</p>
	);
}
