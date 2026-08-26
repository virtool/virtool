import LocalOtuIsolates from "@otus-v2/components/LocalOtuIsolates";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId/isolates",
)({
	component: LocalOtuIsolatesRoute,
});

function LocalOtuIsolatesRoute() {
	const { referenceId, otuId } = Route.useParams();

	return <LocalOtuIsolates referenceId={referenceId} otuId={otuId} />;
}
