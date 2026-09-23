import ReferenceV2Settings from "@references-v2/components/ReferenceV2Settings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/alpha/$referenceId/settings",
)({
	component: ReferenceV2SettingsRoute,
});

function ReferenceV2SettingsRoute() {
	const { referenceId } = Route.useParams();

	return <ReferenceV2Settings referenceId={referenceId} />;
}
