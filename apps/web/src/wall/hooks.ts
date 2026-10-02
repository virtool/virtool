import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
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
