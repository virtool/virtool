import { handleIndexFile } from "@server/indexes/download";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: the client reaches this with a plain
// `<a href>`, so the browser has to receive a real response carrying a
// `Content-Disposition` header, and the bytes stream straight out of storage.
export const Route = createFileRoute("/indexes/$indexId/files/$filename")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleIndexFile(request, params.indexId, params.filename),
		},
	},
});
