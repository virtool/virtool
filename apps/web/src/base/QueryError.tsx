import Alert from "./Alert";

type QueryErrorProps = {
	noun: string;
};

/**
 * Inline error for a failed secondary (Tier 2) query. Contains the failure to
 * one view — a list, sidebar widget, or banner — instead of escalating to the
 * route-level `RouteError` takeover used for primary data.
 *
 * Render it when `isError && !data`, before the `isPending` check. An initial
 * error has no data either, and a failed refetch keeps showing its stale data.
 */
export default function QueryError({ noun }: QueryErrorProps) {
	return <Alert color="red">Couldn't load {noun}.</Alert>;
}
