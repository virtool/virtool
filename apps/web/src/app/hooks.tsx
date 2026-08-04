import { readServerNow } from "@app/serverNow";
import type { RefObject } from "react";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

// Advanced only on a tick. `Date.now` cannot be the snapshot itself: React
// calls it repeatedly to decide whether the store changed, and a value that
// differs on every call never settles — it warns that the result should be
// cached, and re-renders until it does.
let now = Date.now();

function subscribeToTime(callback: () => void) {
	const interval = setInterval(() => {
		now = Date.now();
		callback();
	}, 1000);

	return () => clearInterval(interval);
}

function getNow() {
	return now;
}

/**
 * The current time in epoch milliseconds, refreshed every second.
 *
 * Subscribed to rather than read during render, so render stays a pure function
 * of its inputs — the React Compiler would otherwise cache the first reading
 * and never recompute it.
 */
export function useNow(): number {
	return useSyncExternalStore(subscribeToTime, getNow, readServerNow);
}

// Whether a document is secure is fixed for its lifetime, so there is nothing
// to subscribe to.
function subscribeToNothing() {
	return () => {};
}

function readIsSecureContext() {
	return window.isSecureContext;
}

function readIsSecureContextOnServer() {
	return false;
}

/**
 * Whether the document is in a secure context, and with it whether the
 * clipboard API can be reached.
 *
 * Read through a store rather than straight off `window`, which does not exist
 * while rendering on the server. A `typeof window` guard would only convert
 * that crash into a hydration mismatch; React uses the server snapshot for both
 * the server render and the hydration render that has to match it, then swaps
 * in the real value on the pass immediately after.
 */
export function useIsSecureContext(): boolean {
	return useSyncExternalStore(
		subscribeToNothing,
		readIsSecureContext,
		readIsSecureContextOnServer,
	);
}

/**
 * Two-way binding for an input whose committed value lives in the parent (URL,
 * store, etc.). Returns a local `draft` for the input and a setter; commits
 * `draft` to `onChange` after it's been stable for `delayMs`.
 *
 * A change to `value` from outside — back/forward navigation, a cleared filter —
 * is authoritative: it replaces the draft and abandons any pending commit. That
 * resync happens during render rather than in an effect so a stale draft can
 * never reach the timer and undo the change that just arrived.
 *
 * The guard tracks the last `value` we synced from, not the value we last
 * committed. Advancing a committed baseline locally would run ahead of an async
 * `onChange` (URL navigation) whose echo lands a render later: the guard would
 * read the still-stale `value`, treat it as an outside change, and blank the
 * draft until the echo caught up.
 */
export function useDebounce<T>(
	value: T,
	onChange: (next: T) => void,
	delayMs = 250,
): [T, (next: T) => void] {
	const [draft, setDraft] = useState(value);
	const [prevValue, setPrevValue] = useState(value);

	if (value !== prevValue) {
		setPrevValue(value);
		setDraft(value);
	}

	// Held in a ref so a parent re-render that only changes the callback's
	// identity doesn't restart the delay out from under the typist. Synced in a
	// layout effect, not a passive one, so a pending timer that fires in the
	// commit-to-effect gap can't invoke a stale setter and navigate with an
	// out-of-date search object.
	const onChangeRef = useRef(onChange);

	useLayoutEffect(() => {
		onChangeRef.current = onChange;
	});

	useEffect(() => {
		if (draft === value) {
			return;
		}

		const id = setTimeout(() => {
			onChangeRef.current(draft);
		}, delayMs);

		return () => clearTimeout(id);
	}, [delayMs, draft, value]);

	return [draft, setDraft];
}

const defaultRootFontSize = 16;

const rootFontSizeListeners = new Set<() => void>();

let rootFontSizeProbe: HTMLDivElement | null = null;
let rootFontSizeObserver: ResizeObserver | null = null;
let rootFontSize = defaultRootFontSize;

function measureRootFontSize(): number {
	const size = Number.parseFloat(
		getComputedStyle(document.documentElement).fontSize,
	);

	// A document that has resolved no size of its own reports a keyword, and a
	// font size cannot be zero, so neither answer is one to divide a layout by.
	return size > 0 ? size : defaultRootFontSize;
}

function subscribeToRootFontSize(callback: () => void) {
	rootFontSizeListeners.add(callback);

	if (!rootFontSizeProbe) {
		// Changing the preference fires no event, and the root's own box need not
		// resize when it does — but a 1rem-wide element always does. One is kept
		// off-screen and watched, once for the page rather than once per caller.
		rootFontSizeProbe = document.createElement("div");
		rootFontSizeProbe.setAttribute("aria-hidden", "true");
		rootFontSizeProbe.style.cssText =
			"height:0;position:absolute;visibility:hidden;width:1rem";

		document.body.appendChild(rootFontSizeProbe);

		rootFontSize = measureRootFontSize();

		rootFontSizeObserver = new ResizeObserver(() => {
			const next = measureRootFontSize();

			if (next !== rootFontSize) {
				rootFontSize = next;
				for (const listener of rootFontSizeListeners) {
					listener();
				}
			}
		});

		rootFontSizeObserver.observe(rootFontSizeProbe);
	}

	return () => {
		rootFontSizeListeners.delete(callback);

		if (rootFontSizeListeners.size === 0) {
			rootFontSizeObserver?.disconnect();
			rootFontSizeObserver = null;
			rootFontSizeProbe?.remove();
			rootFontSizeProbe = null;
			rootFontSize = defaultRootFontSize;
		}
	};
}

function getRootFontSize(): number {
	return rootFontSize;
}

function getDefaultRootFontSize(): number {
	return defaultRootFontSize;
}

/**
 * The reader's font-size preference, in CSS pixels.
 *
 * Sizes belong in rem, where the browser scales them without being asked. This
 * is for the few that cannot be a CSS length and have to be a number — a
 * threshold compared against a measured width, a virtualizer's row height.
 *
 * It is subscribed to rather than read during render. The compiler caches
 * render against its inputs, and a figure read out of the document is not one
 * of them, so a preference that changed would never reach the screen.
 */
export function useRootFontSize(): number {
	return useSyncExternalStore(
		subscribeToRootFontSize,
		getRootFontSize,
		getDefaultRootFontSize,
	);
}

type Size = {
	height: number;
	width: number;
};

export function useElementSize<T extends HTMLElement>(): [
	RefObject<T | null>,
	Size,
] {
	const ref = useRef<T>(null);
	const [size, setSize] = useState<Size>({ height: 0, width: 0 });

	useEffect(() => {
		const element = ref.current;

		function measure() {
			const height = element?.offsetHeight ?? 0;
			const width = element?.offsetWidth ?? 0;

			setSize((current) =>
				current.height === height && current.width === width
					? current
					: { height, width },
			);
		}

		measure();

		if (!element) {
			return;
		}

		// The element is observed rather than the window, because it resizes
		// without the window doing so: a list growing past the viewport takes a
		// scrollbar and narrows everything beside it. Measured once, a chart stays
		// laid out to a width it no longer has, and leaves a strip of its container
		// undrawn down the right-hand side.
		const observer = new ResizeObserver(measure);

		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	return [ref, size];
}
