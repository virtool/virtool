import { accountQueryOptions } from "@account/account";
import {
	formatCalendarTime,
	formatDateTime,
	formatDistanceStrict,
} from "@app/date";
import { readServerNow } from "@app/serverNow";
import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import type { TimeFormat } from "@virtool/contracts";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { type MouseEvent, useState, useSyncExternalStore } from "react";

const TICK_INTERVAL = 8000;

// One ticker drives every relative time on the page. Lists render a time per
// row, so an interval per instance would mean dozens of timers firing on
// independent schedules, each re-rendering its own row.
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

// Holds the space of an absolute time until hydration. Absolute times vary in
// width, so this matches the common case of a date earlier in the year.
const ABSOLUTE_PLACEHOLDER = "Sep 26 at 00:00";

/**
 * Create a human-readable relative time.
 *
 * The time may land in the future when the browser clock lags the server's, so
 * it is clamped to `now` — `formatDistanceStrict` would otherwise render it as
 * "in 5 seconds".
 */
function createRelativeTimeString(time: Date, now: number) {
	const timeString = formatDistanceStrict(
		new Date(Math.min(time.getTime(), now)),
		now,
		{ addSuffix: true },
	);

	return timeString.startsWith("in ") ? "just now" : timeString;
}

/** The time format the signed-in user prefers. */
function useTimeFormat(): TimeFormat {
	// Read from the cache only. Every signed-in route resolves the account
	// before it renders, and a page without one shows relative times.
	const { data } = useQuery({
		...accountQueryOptions(),
		enabled: false,
		select: (account) => account.settings.timeFormat,
	});

	return data ?? "relative";
}

/** A time in both formats, with the one the user prefers first. */
type TimeText = {
	/** Text that goes before `primary` in a sentence, such as "on ". */
	prefix: string;

	/** The time in the format the user prefers. */
	primary: string;

	/**
	 * The tooltip text: the exact date and time of a relative time, or the
	 * relative time of an absolute time.
	 */
	secondary: string;

	/**
	 * Whether `primary` is a placeholder that holds the space of an absolute
	 * time until hydration.
	 */
	placeholder: boolean;
};

type TimeTextOptions = {
	/** Whether the time continues a sentence. See {@link TimeProps}. */
	sentence?: boolean;
};

/**
 * Get the text for a time in the format the user prefers and in the other
 * format. The text refreshes as time passes.
 *
 * An absolute time reads by calendar day, such as "Today at 11:12" or "Sep 26,
 * 2023". The exact date and time is the tooltip of a relative time.
 *
 * The server renders in its container's time zone, not the viewer's, so an
 * absolute time is a placeholder until hydration. React does not patch a
 * suppressed text mismatch, so a server-rendered value would stay on screen.
 *
 * The text comes from a clock the component subscribes to, rather than from
 * `Date.now()`. A render that reads the clock is impure, and the React Compiler
 * would pin its result to the last time `time` changed.
 */
export function useTimeText(
	time: Date | null,
	{ sentence = false }: TimeTextOptions = {},
): TimeText | null {
	// Called unconditionally, before the null check: a hook cannot be called
	// behind a branch, and a row whose timestamp is null must not change how
	// many hooks this component runs.
	const now = useSyncExternalStore(subscribe, getNow, readServerNow);
	const hydrated = useHydrated();
	const format = useTimeFormat();

	if (time === null) {
		return null;
	}

	const relative = createRelativeTimeString(time, now);

	if (format === "relative") {
		return {
			placeholder: false,
			prefix: "",
			primary: relative,
			secondary: hydrated ? formatDateTime(time) : "",
		};
	}

	if (!hydrated) {
		return {
			placeholder: true,
			prefix: sentence ? "on " : "",
			primary: ABSOLUTE_PLACEHOLDER,
			secondary: relative,
		};
	}

	const { day, text } = formatCalendarTime(time, now);

	if (!sentence) {
		return {
			placeholder: false,
			prefix: "",
			primary: text,
			secondary: relative,
		};
	}

	// "Last changed today at 11:12", but "Last changed on Sep 26 at 14:03".
	return day === null
		? { placeholder: false, prefix: "on ", primary: text, secondary: relative }
		: {
				placeholder: false,
				prefix: "",
				primary: text.charAt(0).toLowerCase() + text.slice(1),
				secondary: relative,
			};
}

type TimeProps = {
	/**
	 * Whether the time continues a sentence. An absolute time then reads
	 * "today at 11:12" or "on Sep 26 at 14:03", so "Last changed" and "This job
	 * finished" still read correctly.
	 */
	sentence?: boolean;

	/**
	 * The instant to show, or null if the row does not record one.
	 *
	 * Nullable because the timestamp columns behind these are nullable in
	 * Postgres. Absence renders as nothing at all rather than as an epoch date,
	 * which `new Date(null)` would otherwise present as a real instant in 1970.
	 */
	time: Date | null;
};

/**
 * Shows a time in the format the signed-in user prefers, relative ("3 days
 * ago") or absolute ("Today at 11:12"). The tooltip of a relative time shows
 * the exact date and time, and the tooltip of an absolute time shows the
 * relative time.
 *
 * The tooltip opens on hover, on keyboard focus, and on tap.
 */
export default function Time({ sentence = false, time }: TimeProps) {
	const text = useTimeText(time, { sentence });
	const [open, setOpen] = useState(false);

	if (time === null || text === null) {
		return null;
	}

	// A tap does not hover, and Radix closes a tooltip when its trigger is
	// clicked. Preventing the default keeps Radix from closing it, so a tap
	// opens it. A tap outside closes it.
	function handleClick(event: MouseEvent) {
		event.preventDefault();
		setOpen(true);
	}

	// The text is approximate and drifts as the ticker advances. `dateTime`
	// gives the exact instant to assistive technology and anything that parses
	// the page.
	return (
		<>
			{text.prefix}
			<TooltipPrimitive.Provider>
				<TooltipPrimitive.Root
					open={text.placeholder ? false : open}
					onOpenChange={setOpen}
				>
					<TooltipPrimitive.Trigger asChild>
						<button
							className="cursor-default rounded-sm tabular-nums"
							onClick={handleClick}
							type="button"
						>
							<time
								className={text.placeholder ? "invisible" : undefined}
								dateTime={time.toISOString()}
							>
								{text.primary}
							</time>
						</button>
					</TooltipPrimitive.Trigger>
					<TooltipPrimitive.Portal>
						<TooltipPrimitive.Content
							className="rounded px-4 py-2 text-sm leading-none bg-gray-800 text-white shadow-lg z-popover data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade"
							side="top"
							sideOffset={5}
						>
							{text.secondary}
							<TooltipPrimitive.Arrow className="fill-gray-800" />
						</TooltipPrimitive.Content>
					</TooltipPrimitive.Portal>
				</TooltipPrimitive.Root>
			</TooltipPrimitive.Provider>
		</>
	);
}
