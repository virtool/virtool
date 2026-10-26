import { type PasskeyAutofill, startPasskeyAutofill } from "@app/passkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import {
	type AuthNextStep,
	getAuthNextStepRoute,
	resolveAuthNextStep,
} from "./nextStep";

/**
 * Read bearer parameters from the URL fragment or query, strip them from
 * history, and pass them to `onCapture` once.
 *
 * The parameters are removed before any request can send the URL as a
 * referrer. The guard keeps a repeated effect, such as the StrictMode
 * remount, from reading the already stripped URL.
 */
export function useCapturedUrlParams<K extends string>(
	names: readonly K[],
	onCapture: (params: Record<K, string | null>) => void,
) {
	const captured = useRef(false);

	useLayoutEffect(() => {
		if (captured.current) {
			return;
		}
		captured.current = true;

		const fragment = new URLSearchParams(window.location.hash.slice(1));
		const query = new URLSearchParams(window.location.search);
		const params = Object.fromEntries(
			names.map((name) => [name, fragment.get(name) ?? query.get(name)]),
		) as Record<K, string | null>;

		window.history.replaceState(
			window.history.state,
			"",
			window.location.pathname,
		);

		onCapture(params);
	}, []);
}

/**
 * Return a function that resolves the next step from the server and navigates
 * to it.
 *
 * A `password_reset` step is returned without navigation, because the login
 * wall shows the reset form in place.
 */
export function useFollowAuthNextStep() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return async function follow(redirect?: string): Promise<AuthNextStep> {
		const step = await resolveAuthNextStep(queryClient);
		if (step.type !== "password_reset") {
			await navigate({
				...getAuthNextStepRoute(step, redirect),
				replace: true,
			});
		}
		return step;
	};
}

// Better Auth keeps a passkey challenge for 300 seconds.
const AUTOFILL_REFRESH_MS = 270_000;

type PasskeyAutofillOptions = {
	/** Whether the username field can offer passkeys now. */
	enabled: boolean;
	/** Called when a passkey from the autofill signs the user in. */
	onSignedIn: () => void;
	/** Called when the server refuses a passkey from the autofill. */
	onError: (error: unknown) => void;
};

/**
 * Keep a passkey request in the autofill of the username field while
 * `enabled` is true.
 *
 * The request starts again before its challenge expires and after a refused
 * passkey. The returned function stops the request and resolves `true` if a
 * passkey signed the user in first. Call it before an explicit passkey
 * sign-in, and set `enabled` to false while that sign-in runs, because two
 * ceremonies at a time make the browser and the server drop one.
 */
export function usePasskeyAutofill({
	enabled,
	onSignedIn,
	onError,
}: PasskeyAutofillOptions): () => Promise<boolean> {
	const current = useRef<PasskeyAutofill | null>(null);
	const paused = useRef(false);
	const signedIn = useEffectEvent(onSignedIn);
	const failed = useEffectEvent(onError);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		paused.current = false;
		let active = true;
		let refresh: ReturnType<typeof setTimeout> | undefined;

		function start() {
			if (!active || paused.current) {
				return;
			}
			const autofill = startPasskeyAutofill();
			current.current = autofill;
			refresh = setTimeout(restart, AUTOFILL_REFRESH_MS);
			autofill.result.then(
				(done) => {
					// A stopped request reports its sign-in to the caller of the stop.
					if (active && done && !paused.current) {
						signedIn();
					}
				},
				(error: unknown) => {
					if (active) {
						failed(error);
						restart();
					}
				},
			);
		}

		function restart() {
			clearTimeout(refresh);
			void (current.current?.stop() ?? Promise.resolve()).then(start);
		}

		// A request from an earlier run can still be waiting for its options.
		restart();

		return () => {
			active = false;
			clearTimeout(refresh);
			void current.current?.stop();
		};
	}, [enabled]);

	return async () => {
		paused.current = true;
		return (await current.current?.stop()) ?? false;
	};
}
