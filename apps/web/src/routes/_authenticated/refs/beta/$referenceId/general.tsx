import ReferenceV2Detail from "@references-v2/components/ReferenceV2Detail";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/general",
)({
	component: ReferenceV2GeneralRoute,
});

function ReferenceV2GeneralRoute() {
	const { referenceId } = Route.useParams();

	return <ReferenceV2Detail referenceId={referenceId} />;
}
