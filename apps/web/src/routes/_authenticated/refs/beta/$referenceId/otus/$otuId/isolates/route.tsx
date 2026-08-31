import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId/isolates",
)({
	component: LocalOtuIsolatesLayout,
});

function LocalOtuIsolatesLayout() {
	return <Outlet />;
}
