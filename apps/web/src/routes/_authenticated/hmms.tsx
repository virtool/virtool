import { ContainerNarrow } from "@base/Container";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/hmms")({
	component: HmmLayout,
});

function HmmLayout() {
	return (
		<ContainerNarrow>
			<Outlet />
		</ContainerNarrow>
	);
}
