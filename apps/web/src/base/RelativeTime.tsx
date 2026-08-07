import { formatDistanceStrict } from "@app/date";
import { readServerNow } from "@app/serverNow";
import { useSyncExternalStore } from "react";

type RelativeTimeOptions = {
	addSuffix?: boolean;
};

const TICK_INTERVAL = 8000;

// One ticker drives every relative time on the page. Lists render an
// `<Attribution />` per row, so an interval per instance would mean dozens of
// timers firing on independent schedules, each re-rendering its own row.
const listeners = new Set<() => void>();

let intervalId: number | undefined;
let now = Date.now();

function subscribe(listener: () => void) {
	listeners.add(listener);

	// `now` only moves on a tick, so a component mounting into an already
	// running ticker would otherwise read a snapshot up to TICK_INTERVAL old.
	// React re-reads the snapshot after subscribing, so this is picked up.
	now = Date.now();

	if (intervalId === undefined) {
		intervalId = window.setInterval(() => {
			now = Date.now();

			for (const notify of listeners) {
				notify();
			}
		}, TICK_INTERVAL);
	}

	return () => {
		listeners.delete(listener);

		if (listeners.size === 0) {
			window.clearInterval(intervalId);
			intervalId = undefined;
		}
	};
}

// The browser's clock, and only ever the browser's: `subscribe` does not run on
// the server, so `now` is the page-load time of a document rather than the
// import time of a process that may have been up for days. The server render
// and the hydration render that has to match it both read `readServerNow`
// instead, and React switches to this one on the pass after hydration.
function getNow() {
	return now;
}

/**
 * Create a human-readable relative time.
 *
 * The time may land in the future when the browser clock lags the server's, so
 * it is clamped to `now` — `formatDistanceStrict` would otherwise render it as
 * "in 5 seconds".
 *
 * @param time - the instant to describe
 * @param now - the instant to measure against
 * @param options.addSuffix - whether to add the "ago" suffix (default: true)
 * @returns a human-readable relative time string
 */
function createTimeString(
	time: Date,
	now: number,
	{ addSuffix = true }: RelativeTimeOptions = {},
) {
	const target = time.getTime();

	const timeString = formatDistanceStrict(
		new Date(Math.min(target, now)),
		now,
		{
			addSuffix,
		},
	);

	return timeString.startsWith("in ") ? "just now" : timeString;
}

/**
 * Track the passed time relative to the current time, refreshing as time passes.
 *
 * The string is derived during render from a clock the component subscribes to,
 * rather than read from `Date.now()` — a render that reads the clock is impure,
 * and the React Compiler would pin its result to the last time `time` changed.
 */
export function useRelativeTime(
	time: Date | null,
	{ addSuffix = true }: RelativeTimeOptions = {},
) {
	// Subscribed unconditionally, before the null check: a hook cannot be called
	// behind a branch, and a row whose timestamp is null must not change how many
	// hooks this component runs.
	const now = useSyncExternalStore(subscribe, getNow, readServerNow);

	return time === null ? null : createTimeString(time, now, { addSuffix });
}

type RelativeTimeProps = {
	/**
	 * The instant to describe, or null if the row does not record one.
	 *
	 * Nullable because the timestamp columns behind these are nullable in
	 * Postgres. Absence renders as nothing at all rather than as an epoch date,
	 * which `new Date(null)` would otherwise present as a real instant in 1970.
	 */
	time: Date | null;
};

/**
 * Shows the passed time prop relative to the current time (eg. 3 days ago). The relative time string is updated
 * automatically as time passes.
 */
export default function RelativeTime({ time }: RelativeTimeProps) {
	const timeString = useRelativeTime(time);

	if (time === null) {
		return null;
	}

	// The rendered text is approximate and drifts as the ticker advances;
	// `dateTime` carries the exact instant, so assistive technology and anything
	// parsing the page get the real value rather than "3 days ago".
	return <time dateTime={time.toISOString()}>{timeString}</time>;
}
