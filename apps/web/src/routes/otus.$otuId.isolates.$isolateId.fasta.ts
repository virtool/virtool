import { handleIsolateFasta } from "@server/otus/fasta";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: see `otus.$otuId.fasta.ts`.
export const Route = createFileRoute("/otus/$otuId/isolates/$isolateId/fasta")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleIsolateFasta(request, params.otuId, params.isolateId),
		},
	},
});
