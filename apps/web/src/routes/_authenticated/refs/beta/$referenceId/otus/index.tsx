import { getErrorStatus } from "@app/queryErrors";
import Badge from "@base/Badge";
import { buttonVariants } from "@base/Button";
import SectionHeader from "@base/SectionHeader";
import LocalOtuV2List from "@otus-v2/components/LocalOtuV2List";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/",
)({
	loader: async ({ context: { queryClient }, params: { referenceId } }) => {
		const { localOtusV2QueryOptions } = await import("@otus-v2/queries");

		try {
			await queryClient.ensureQueryData(localOtusV2QueryOptions(referenceId));
		} catch (error) {
			if (getErrorStatus(error) === 404) {
				throw notFound();
			}
			throw error;
		}
	},
	component: LocalOtusRoute,
});

function LocalOtusRoute() {
	const { referenceId } = Route.useParams();

	return (
		<div>
			<SectionHeader>
				<h2>
					OTUs <Badge color="purple">Beta</Badge>
				</h2>
				<p>Browse the OTUs in this reference.</p>
			</SectionHeader>

			<div className="mb-4 flex justify-end">
				<Link
					className={buttonVariants({ color: "blue" })}
					to="/refs/beta/$referenceId/otus/new"
					params={{ referenceId }}
				>
					Create OTU
				</Link>
			</div>

			<LocalOtuV2List referenceId={referenceId} />
		</div>
	);
}
