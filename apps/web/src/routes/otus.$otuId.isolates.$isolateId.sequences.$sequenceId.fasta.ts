import { handleSequenceFasta } from "@server/otus/fasta";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: see `otus.$otuId.fasta.ts`.
export const Route = createFileRoute(
	"/otus/$otuId/isolates/$isolateId/sequences/$sequenceId/fasta",
)({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleSequenceFasta(
					request,
					params.otuId,
					params.isolateId,
					params.sequenceId,
				),
		},
	},
});
