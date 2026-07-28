import { handleOtuFasta } from "@server/otus/fasta";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: the client reaches this with a plain
// `<a href>`, so the browser has to receive a real response carrying a
// `Content-Disposition` header.
export const Route = createFileRoute("/otus/$otuId/fasta")({
	server: {
		handlers: {
			GET: ({ request, params }) => handleOtuFasta(request, params.otuId),
		},
	},
});
