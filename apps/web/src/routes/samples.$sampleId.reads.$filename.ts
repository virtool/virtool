import { handleSampleReads } from "@server/samples/download";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: the client reaches this with a plain
// `<a href>`, so the browser has to receive a real response carrying a
// `Content-Disposition` header, and the bytes stream straight out of storage.
export const Route = createFileRoute("/samples/$sampleId/reads/$filename")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleSampleReads(request, params.sampleId, params.filename),
		},
	},
});
