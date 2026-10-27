import { handleUploadFinalize } from "@server/uploads/upload";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/uploads_/$uploadId/finalize")({
	server: {
		handlers: {
			POST: ({ request, params }) =>
				handleUploadFinalize(request, params.uploadId),
		},
	},
});
