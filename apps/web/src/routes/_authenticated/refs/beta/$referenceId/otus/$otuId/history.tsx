import LocalOtuHistory from "@otus-v2/components/LocalOtuHistory";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId/history",
)({
	component: LocalOtuHistoryRoute,
});

function LocalOtuHistoryRoute() {
	const { referenceId, otuId } = Route.useParams();

	return <LocalOtuHistory referenceId={referenceId} otuId={otuId} />;
}
