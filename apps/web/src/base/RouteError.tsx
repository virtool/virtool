import { getErrorStatus } from "@app/queryErrors";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import {
	FORBIDDEN_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { useEffect } from "react";
import Button from "./Button";
import ErrorState from "./ErrorState";
import NotFound from "./NotFound";

function getStatus(error: unknown): number | undefined {
	// The auth errors cross the boundary carrying `name` but no `status`, so
	// they are matched by name, as the query retry logic in `router.tsx` does.
	if (error instanceof Error) {
		if (error.name === FORBIDDEN_ERROR_NAME) {
			return 403;
		}
		if (error.name === UNAUTHORIZED_ERROR_NAME) {
			return 401;
		}
	}

	return getErrorStatus(error);
}

/**
 * The router's default `errorComponent`: renders when a route loader rejects
 * or a `useSuspenseQuery` throws, instead of leaving the route blank.
 *
 * A 401/403 reads as an access problem, a 404 as a missing resource, and
 * anything else as a retryable error. "Try again" clears the cached query
 * error and re-runs the route loader, so a transient failure recovers without
 * a full page reload.
 */
export default function RouteError({ error }: ErrorComponentProps) {
	const router = useRouter();
	const { reset } = useQueryErrorResetBoundary();

	useEffect(() => {
		// Clear React Query's error state so an invalidate-driven refetch can
		// resolve the suspense query and unmount this boundary.
		reset();
	}, [reset]);

	const status = getStatus(error);

	if (status === 401) {
		return (
			<NotFound
				status={401}
				message="You need to sign in to view this resource"
			/>
		);
	}

	if (status === 403) {
		return (
			<NotFound status={403} message="You don't have access to this resource" />
		);
	}

	if (status === 404) {
		return <NotFound />;
	}

	return (
		<ErrorState>
			<Button color="blue" onClick={() => router.invalidate()}>
				Try again
			</Button>
		</ErrorState>
	);
}
