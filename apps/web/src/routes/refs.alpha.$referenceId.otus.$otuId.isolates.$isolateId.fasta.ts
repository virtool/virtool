import { handleV2Fasta } from "@server/otus-v2/fasta";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/refs/alpha/$referenceId/otus/$otuId/isolates/$isolateId/fasta",
)({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleV2Fasta(request, {
					referenceId: params.referenceId,
					otuId: params.otuId,
					isolateId: params.isolateId,
				}),
		},
	},
});
