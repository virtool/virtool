import { handleUploadInitialize } from "@server/uploads/upload";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/uploads")({
	server: {
		handlers: {
			POST: ({ request }) => handleUploadInitialize(request),
		},
	},
});
