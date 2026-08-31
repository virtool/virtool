import LocalOtuIsolateDetail from "@otus-v2/components/LocalOtuIsolateDetail";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId/isolates/$isolateId",
)({
	component: LocalOtuIsolateDetail,
});
