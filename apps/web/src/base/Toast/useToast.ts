import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { ToastActionElement, ToastRootProps } from "./Toast";

const TOAST_LIMIT = 3;

/** How long a dismissed toast lingers in state before it is dropped. */
const TOAST_REMOVE_DELAY = 400;

/** A queued toast: the props a {@link Toast} takes plus its rendered content. */
export type ToasterToast = ToastRootProps & {
	id: string;
	title?: ReactNode;
	description?: ReactNode;
	action?: ToastActionElement;
};

const actionTypes = {
	ADD_TOAST: "ADD_TOAST",
	UPDATE_TOAST: "UPDATE_TOAST",
	DISMISS_TOAST: "DISMISS_TOAST",
	REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

// A monotonic per-session counter, not randomness: an id only has to be unique
// among the handful of toasts alive at once, and render stays free of the
// `Math.random` this would otherwise reach for.
function genId(): string {
	count = (count + 1) % Number.MAX_SAFE_INTEGER;
	return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
	| { type: ActionType["ADD_TOAST"]; toast: ToasterToast }
	| { type: ActionType["UPDATE_TOAST"]; toast: Partial<ToasterToast> }
	| { type: ActionType["DISMISS_TOAST"]; toastId?: ToasterToast["id"] }
	| { type: ActionType["REMOVE_TOAST"]; toastId?: ToasterToast["id"] };

type State = { toasts: ToasterToast[] };

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addToRemoveQueue(toastId: string): void {
	if (toastTimeouts.has(toastId)) {
		return;
	}

	const timeout = setTimeout(() => {
		toastTimeouts.delete(toastId);
		dispatch({ type: "REMOVE_TOAST", toastId });
	}, TOAST_REMOVE_DELAY);

	toastTimeouts.set(toastId, timeout);
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case "ADD_TOAST":
			return {
				...state,
				toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
			};

		case "UPDATE_TOAST":
			return {
				...state,
				toasts: state.toasts.map((toast) =>
					toast.id === action.toast.id ? { ...toast, ...action.toast } : toast,
				),
			};

		case "DISMISS_TOAST": {
			const { toastId } = action;

			if (toastId) {
				addToRemoveQueue(toastId);
			} else {
				for (const toast of state.toasts) {
					addToRemoveQueue(toast.id);
				}
			}

			return {
				...state,
				toasts: state.toasts.map((toast) =>
					toast.id === toastId || toastId === undefined
						? { ...toast, open: false }
						: toast,
				),
			};
		}

		case "REMOVE_TOAST":
			if (action.toastId === undefined) {
				return { ...state, toasts: [] };
			}

			return {
				...state,
				toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
			};
	}
}

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action): void {
	memoryState = reducer(memoryState, action);

	for (const listener of listeners) {
		listener(memoryState);
	}
}

type ToastInput = Omit<ToasterToast, "id">;

/** Queue a toast, returning handles to update or dismiss it. */
export function toast(props: ToastInput) {
	const id = genId();

	function update(next: Partial<ToasterToast>): void {
		dispatch({ type: "UPDATE_TOAST", toast: { ...next, id } });
	}

	function dismiss(): void {
		dispatch({ type: "DISMISS_TOAST", toastId: id });
	}

	dispatch({
		type: "ADD_TOAST",
		toast: {
			...props,
			id,
			open: true,
			onOpenChange(open) {
				if (!open) {
					dismiss();
				}
			},
		},
	});

	return { id, dismiss, update };
}

/** Subscribe to the toast queue and the actions that drive it. */
export function useToast() {
	const [state, setState] = useState<State>(memoryState);

	useEffect(() => {
		listeners.push(setState);

		return () => {
			const index = listeners.indexOf(setState);

			if (index > -1) {
				listeners.splice(index, 1);
			}
		};
	}, []);

	return {
		...state,
		toast,
		dismiss(toastId?: string) {
			dispatch({ type: "DISMISS_TOAST", toastId });
		},
	};
}
