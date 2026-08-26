import LocalOtuOverview from "@otus-v2/components/LocalOtuOverview";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId/",
)({
	component: LocalOtuOverviewRoute,
});

function LocalOtuOverviewRoute() {
	const { referenceId, otuId } = Route.useParams();

	return <LocalOtuOverview referenceId={referenceId} otuId={otuId} />;
}
