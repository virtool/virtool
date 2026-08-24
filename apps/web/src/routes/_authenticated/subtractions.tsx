import { ContainerNarrow } from "@base/Container";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/subtractions")({
	component: SubtractionsLayout,
});

function SubtractionsLayout() {
	return (
		<ContainerNarrow>
			<Outlet />
		</ContainerNarrow>
	);
}
