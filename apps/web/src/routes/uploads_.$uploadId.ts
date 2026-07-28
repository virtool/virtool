import { handleUploadDownload } from "@server/uploads/download";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: the client reaches this with a plain
// `<a href>`, so the browser has to receive a real response carrying a
// `Content-Disposition` header, and the bytes stream straight out of storage.
//
// The trailing underscore keeps this out of `routes/uploads.ts`, which would
// otherwise become its parent purely because the URLs share a segment. The two
// routes have nothing to do with each other — that one takes the POST that
// creates an upload — and the URL is `/uploads/$uploadId` either way.
export const Route = createFileRoute("/uploads_/$uploadId")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleUploadDownload(request, params.uploadId),
		},
	},
});
