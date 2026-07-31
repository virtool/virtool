import type { RefObject } from "react";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

function subscribeToTime(callback: () => void) {
	const interval = setInterval(callback, 1000);
	return () => clearInterval(interval);
}

export function useNow() {
	return useSyncExternalStore(subscribeToTime, Date.now, Date.now);
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

function formatSearchParams(
	params: Record<
		string,
		string | number | boolean | null | Array<string | number | boolean>
	>,
) {
	const searchParams = new URLSearchParams();

	Object.entries(params).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((arrayValue) => {
				searchParams.append(key, String(arrayValue));
			});
		} else {
			searchParams.set(key, String(value));
		}
	});

	return `?${searchParams.toString()}`;
}

export function formatPath(
	basePath: string,
	searchParams: Record<
		string,
		string | number | boolean | null | Array<string | number | boolean>
	>,
) {
	return basePath + formatSearchParams(searchParams);
}
