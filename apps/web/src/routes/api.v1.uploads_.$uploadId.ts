import { handleUploadCancel } from "@server/uploads/upload";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/uploads_/$uploadId")({
	server: {
		handlers: {
			DELETE: ({ request, params }) =>
				handleUploadCancel(request, params.uploadId),
		},
	},
});
