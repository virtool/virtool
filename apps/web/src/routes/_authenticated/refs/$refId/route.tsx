import { getErrorStatus } from "@app/queryErrors";
import { ContainerNarrow } from "@base/Container";
import ReferenceDetailHeader from "@references/components/Detail/ReferenceDetailHeader";
import ReferenceDetailTabs from "@references/components/Detail/ReferenceDetailTabs";
import { useFetchReference } from "@references/queries";
import {
	createFileRoute,
	notFound,
	Outlet,
	useMatches,
} from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/refs/$refId")({
	loader: async ({ context: { queryClient }, params: { refId } }) => {
		const { referenceQueryOptions } = await import("@references/queries");

		try {
			await queryClient.ensureQueryData(referenceQueryOptions(Number(refId)));
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: ReferenceDetailLayout,
});

function ReferenceDetailLayout() {
	const { refId } = Route.useParams();
	const { data } = useFetchReference(Number(refId));
	const isOtuDetail = useMatches().some(
		(match) => match.routeId === "/_authenticated/refs/$refId/otus/$otuId",
	);

	if (!data) {
		return null;
	}

	return (
		<>
			{!isOtuDetail && (
				<>
					<ReferenceDetailHeader
						createdAt={data.createdAt}
						detail={data}
						name={data.name}
						userHandle={data.user?.handle ?? ""}
					/>
					<ReferenceDetailTabs id={refId} otuCount={data.otuCount} />
				</>
			)}

			<ContainerNarrow>
				<Outlet />
			</ContainerNarrow>
		</>
	);
}
