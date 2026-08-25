import Badge from "@base/Badge";
import { ContainerNarrow } from "@base/Container";
import SectionHeader from "@base/SectionHeader";
import CreateReferenceV2Form from "@references-v2/components/CreateReferenceV2Form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/refs-v2/")({
	component: ReferencesV2Route,
});

function ReferencesV2Route() {
	return (
		<ContainerNarrow>
			<SectionHeader>
				<h2>
					Create Reference <Badge color="purple">Beta</Badge>
				</h2>
				<p>Create a local v2 Reference.</p>
			</SectionHeader>
			<CreateReferenceV2Form />
		</ContainerNarrow>
	);
}
