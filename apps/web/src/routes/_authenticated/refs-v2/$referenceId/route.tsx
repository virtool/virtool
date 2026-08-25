import { getErrorStatus } from "@app/queryErrors";
import { ContainerNarrow } from "@base/Container";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/refs-v2/$referenceId")({
	loader: async ({ context: { queryClient }, params: { referenceId } }) => {
		const { referenceV2QueryOptions } = await import("@references-v2/queries");

		try {
			await queryClient.ensureQueryData(referenceV2QueryOptions(referenceId));
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: ReferenceV2DetailLayout,
});

function ReferenceV2DetailLayout() {
	return (
		<ContainerNarrow>
			<Outlet />
		</ContainerNarrow>
	);
}
