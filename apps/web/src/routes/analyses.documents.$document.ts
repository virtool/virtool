import { handleAnalysisDocument } from "@server/analyses/download";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: the client reaches this with a plain
// `<a href>`, so the browser has to receive a real response carrying a
// `Content-Disposition` header. `$document` is the `{id}.{extension}` segment.
export const Route = createFileRoute("/analyses/documents/$document")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleAnalysisDocument(request, params.document),
		},
	},
});
