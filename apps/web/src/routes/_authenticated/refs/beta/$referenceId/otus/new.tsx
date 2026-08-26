import Badge from "@base/Badge";
import SectionHeader from "@base/SectionHeader";
import CreateLocalOtuForm from "@otus-v2/components/CreateLocalOtuForm";
import CreateLocalOtuFromAccessionForm from "@otus-v2/components/CreateLocalOtuFromAccessionForm";
import { useSuspenseReferenceV2 } from "@references-v2/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/beta/$referenceId/otus/new",
)({
	component: CreateLocalOtuRoute,
});

function CreateLocalOtuRoute() {
	const { referenceId } = Route.useParams();
	const { data: reference } = useSuspenseReferenceV2(referenceId);

	return (
		<div>
			<SectionHeader>
				<h2>
					Create OTU <Badge color="purple">Beta</Badge>
				</h2>
				<p>Create one complete local OTU.</p>
			</SectionHeader>

			<SectionHeader>
				<h3>From GenBank</h3>
				<p>Build an OTU automatically from one or more NCBI accessions.</p>
			</SectionHeader>
			<CreateLocalOtuFromAccessionForm
				referenceId={referenceId}
				defaultSegmentLengthTolerance={reference.defaultSegmentLengthTolerance}
			/>

			<SectionHeader>
				<h3>Manual</h3>
				<p>Enter the OTU details by hand.</p>
			</SectionHeader>
			<CreateLocalOtuForm
				referenceId={referenceId}
				defaultSegmentLengthTolerance={reference.defaultSegmentLengthTolerance}
			/>
		</div>
	);
}
