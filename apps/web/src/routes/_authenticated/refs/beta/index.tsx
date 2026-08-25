import Badge from "@base/Badge";
import { ContainerNarrow } from "@base/Container";
import SectionHeader from "@base/SectionHeader";
import ReferenceV2List from "@references-v2/components/ReferenceV2List";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/refs/beta/")({
	loader: async ({ context: { queryClient } }) => {
		const { referencesV2QueryOptions } = await import("@references-v2/queries");
		await queryClient.ensureQueryData(referencesV2QueryOptions());
	},
	component: ReferencesV2Route,
});

function ReferencesV2Route() {
	return (
		<ContainerNarrow>
			<SectionHeader>
				<h2>
					References <Badge color="purple">Beta</Badge>
				</h2>
				<p>Browse local v2 References.</p>
			</SectionHeader>
			<ReferenceV2List />
		</ContainerNarrow>
	);
}
