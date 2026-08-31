import { getErrorStatus } from "@app/queryErrors";
import Badge from "@base/Badge";
import { ContainerNarrow } from "@base/Container";
import SectionHeader from "@base/SectionHeader";
import ReferenceV2DetailTabs from "@references-v2/components/ReferenceV2DetailTabs";
import { useSuspenseReferenceV2 } from "@references-v2/queries";
import {
	createFileRoute,
	notFound,
	Outlet,
	useMatches,
} from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/refs/beta/$referenceId")({
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
	const { referenceId } = Route.useParams();
	const { data: reference } = useSuspenseReferenceV2(referenceId);
	const isOtuDetail = useMatches().some(
		(match) =>
			match.routeId === "/_authenticated/refs/beta/$referenceId/otus/$otuId",
	);

	return (
		<>
			{!isOtuDetail && (
				<>
					<SectionHeader>
						<h2>
							{reference.name} <Badge color="purple">Beta</Badge>
						</h2>
						<p>{reference.description || "No description."}</p>
					</SectionHeader>
					<ReferenceV2DetailTabs referenceId={referenceId} />
				</>
			)}

			<ContainerNarrow>
				<Outlet />
			</ContainerNarrow>
		</>
	);
}
