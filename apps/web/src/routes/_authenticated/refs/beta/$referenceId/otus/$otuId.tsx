import { getErrorStatus } from "@app/queryErrors";
import LocalOtuDetail from "@otus-v2/components/LocalOtuDetail";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId",
)({
	loader: async ({
		context: { queryClient },
		params: { referenceId, otuId },
	}) => {
		const { localOtuV2QueryOptions } = await import("@otus-v2/queries");

		try {
			await queryClient.ensureQueryData(
				localOtuV2QueryOptions(referenceId, otuId),
			);
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: LocalOtuDetailRoute,
});

function LocalOtuDetailRoute() {
	const { referenceId, otuId } = Route.useParams();

	return <LocalOtuDetail referenceId={referenceId} otuId={otuId} />;
}
