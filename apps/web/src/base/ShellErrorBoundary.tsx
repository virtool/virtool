import Button from "@base/Button";
import * as Sentry from "@sentry/tanstackstart-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorState from "./ErrorState";
import LoadingPlaceholder from "./LoadingPlaceholder";

// Two, so a single stubborn navigation gets a second chance before the user is
// shown a dead end. A third failure in a row is not a race, and remounting
// again would only spin.
const MAX_CONSECUTIVE_RECOVERIES = 2;

type ShellErrorBoundaryProps = {
	children: ReactNode;
};

type ShellErrorBoundaryState = {
	// "recovering" is provisional: `getDerivedStateFromError` cannot tell a race
	// from a real error, so it always parks here and `componentDidCatch` decides.
	status: "ok" | "recovering" | "failed";
};

/**
 * The shell's last-resort error boundary, mounted inside `<body>` above every
 * route match.
 *
 * It exists because the router can throw a value that its own boundaries cannot
 * catch. `MatchInner` throws `getMatchPromise(match, "loadPromise")` to suspend
 * a match that is still settling, and a chained redirect — `/login` to `/`, then
 * `/` to `/samples` — can clear that promise before the match re-renders, so it
 * throws `undefined` instead. TanStack's `CatchBoundary` tests the thrown value
 * for truthiness, so every nested one swallows it and re-throws; the error
 * reaches `hydrateRoot`'s `onUncaughtError`, React unmounts the tree, and the
 * user is left staring at a blank page immediately after signing in. See
 * TanStack/router#7753, still open.
 *
 * A falsy throw is therefore treated as the transient race it is: render a
 * placeholder, then remount the router once the navigation that raced has
 * settled. A real error, or a race that will not settle, falls through to a
 * reload prompt — the app shell is gone by then, so there is nothing left to
 * recover in place.
 */
export default class ShellErrorBoundary extends Component<
	ShellErrorBoundaryProps,
	ShellErrorBoundaryState
> {
	override state: ShellErrorBoundaryState = { status: "ok" };

	consecutiveRecoveries = 0;

	static getDerivedStateFromError(): ShellErrorBoundaryState {
		return { status: "recovering" };
	}

	override componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
		const contexts = {
			react: { componentStack: errorInfo.componentStack ?? undefined },
		};

		if (error) {
			Sentry.captureException(error, { contexts });
			this.setState({ status: "failed" });
			return;
		}

		// The thrown value carries no stack and no message, so report a real Error
		// that names the failure instead. The component stack is the only thing
		// that identifies where it came from.
		Sentry.captureException(
			new Error("Router threw a falsy value and unmounted the app"),
			{ contexts, tags: { router: "falsy-throw" } },
		);

		if (this.consecutiveRecoveries >= MAX_CONSECUTIVE_RECOVERIES) {
			this.setState({ status: "failed" });
			return;
		}

		this.consecutiveRecoveries += 1;

		// A task rather than a microtask: the navigation that raced is still in
		// flight, and remounting into the same half-settled match would only throw
		// again and burn a retry.
		setTimeout(() => {
			this.setState({ status: "ok" });
		}, 0);
	}

	override componentDidUpdate() {
		// The remount rendered without throwing, so the race is over and the next
		// one — minutes or hours from now — starts with a full budget again.
		if (this.state.status === "ok") {
			this.consecutiveRecoveries = 0;
		}
	}

	override render() {
		if (this.state.status === "ok") {
			return this.props.children;
		}

		if (this.state.status === "recovering") {
			return <LoadingPlaceholder />;
		}

		return (
			<ErrorState message="Virtool ran into a problem and couldn't continue">
				<Button color="blue" onClick={() => window.location.reload()}>
					Reload
				</Button>
			</ErrorState>
		);
	}
}
