import { handleV2Fasta } from "@server/otus-v2/fasta";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/refs/alpha/$referenceId/fasta")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleV2Fasta(request, { referenceId: params.referenceId }),
		},
	},
});
