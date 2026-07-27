import { handleSubtractionFile } from "@server/subtraction/download";
import { createFileRoute } from "@tanstack/react-router";

// A raw route, not a server function: the client reaches this with a plain
// `<a href>`, so the browser has to receive a real response carrying a
// `Content-Disposition` header, and the bytes stream straight out of storage.
export const Route = createFileRoute(
	"/subtractions/$subtractionId/files/$filename",
)({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				handleSubtractionFile(request, params.subtractionId, params.filename),
		},
	},
});
