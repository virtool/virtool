import { getErrorStatus } from "@app/queryErrors";
import Link from "@base/Link";
import SectionHeader from "@base/SectionHeader";
import LocalOtuDetailTabs from "@otus-v2/components/LocalOtuDetailTabs";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";
import { useSuspenseReferenceV2 } from "@references-v2/queries";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId",
)({
	loader: async ({
		context: { queryClient },
		params: { referenceId, otuId },
	}) => {
		const { localOtuV2QueryOptions } = await import("@otus-v2/queries");

		try {
			await queryClient.ensureQueryData(
				localOtuV2QueryOptions(referenceId, otuId),
			);
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: LocalOtuDetailLayout,
});

function LocalOtuDetailLayout() {
	const { referenceId, otuId } = Route.useParams();
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);
	const { data: reference } = useSuspenseReferenceV2(referenceId);

	return (
		<>
			<p className="flex font-medium items-center gap-2 py-2">
				<Link to="/refs/beta/$referenceId" params={{ referenceId }}>
					{reference.name}
				</Link>
				<span className="text-slate-600">/</span>
				<Link to="/refs/beta/$referenceId/otus" params={{ referenceId }}>
					OTUs
				</Link>
				<span className="text-slate-600">/</span>
				<Link
					to="/refs/beta/$referenceId/otus/$otuId"
					params={{ referenceId, otuId }}
				>
					{otu.taxonomy.name}
				</Link>
			</p>

			<SectionHeader>
				<h2>
					{otu.taxonomy.name}
					{otu.taxonomy.acronym ? ` (${otu.taxonomy.acronym})` : ""}
				</h2>
				<p>
					OTU <span className="font-mono">{otu.id}</span>
				</p>
			</SectionHeader>

			<LocalOtuDetailTabs referenceId={referenceId} otuId={otuId} />

			<Outlet />
		</>
	);
}
