import ReferenceV2Detail from "@references-v2/components/ReferenceV2Detail";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/refs-v2/$referenceId/")({
	component: ReferenceV2DetailRoute,
});

function ReferenceV2DetailRoute() {
	const { referenceId } = Route.useParams();

	return <ReferenceV2Detail referenceId={referenceId} />;
}
