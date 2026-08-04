import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Sends `/` to the samples list.
 *
 * Deliberately *not* nested under `_authenticated`, even though its target is.
 * Nested, resolving `/` meant running that layout's async guard — a root fetch
 * and an account fetch — and only then throwing a second redirect, so signing
 * in navigated `/login` to `/` to `/samples` with the layout match re-rendering
 * mid-chain. That is the window `MatchInner` throws `undefined` in (see
 * `@base/ShellErrorBoundary`). Here the hop is synchronous and resolves before
 * any match loads, so signing in navigates straight to `/samples`.
 *
 * Nothing is exposed by leaving it unguarded: the route renders nothing, and
 * `/samples` carries the same guard it always did.
 */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/samples" });
	},
});
